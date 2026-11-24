# 以 v5 版資料庫＋真實資料，驗證遷移 001/002（獨立執行與整份 schema.sql 兩條路徑）
import sys, os, json; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from harness import *
import psycopg2
fails=[]
def check(name,cond,extra=''):
    print(('PASS' if cond else 'FAIL'),name,('' if cond else extra))
    if not cond: fails.append(name)
J=lambda x: json.dumps(x,ensure_ascii=False)
V5=open(os.path.join(HERE, 'schema_v5_snapshot.sql'),encoding='utf8').read().replace("create extension if not exists pgcrypto with schema extensions;","-- shim")
M1=open(os.path.join(HERE, '..', 'migrations', '001_has_custom_password.sql'),encoding='utf8').read()
M2=open(os.path.join(HERE, '..', 'migrations', '002_registrations_by_name.sql'),encoding='utf8').read()
ADMIN='2026'

def build_v5():
    s=server(); out=s.psql(V5); assert not [l for l in out.splitlines() if 'ERROR' in l], out[:500]
    conn=psycopg2.connect(s.get_uri()); conn.autocommit=True; cur=conn.cursor()
    def q(sql,*a):
        cur.execute(sql,a or None)
        try: return cur.fetchall()
        except psycopg2.ProgrammingError: return None
    one=lambda sql,*a: q(sql,*a)[0][0]
    # v5 資料：名單、帳號（一位預設密碼、一位已自訂）、營隊、報名、點名
    one("select camp_admin_sync_roster(%s,%s::jsonb)",ADMIN,J([{"student_id":"10101","student_name":"王小明"},{"student_id":"10102","student_name":"李小華"},{"student_id":"10103","student_name":"陳大同"}]))
    one("select camp_verify_student_login(%s,%s,%s)",'王小明','10101','10101')        # 預設密碼
    one("select camp_verify_student_login(%s,%s,%s)",'李小華','10102','10102')
    one("select camp_update_student_profile(%s,%s,%s,%s::jsonb,%s)",'李小華','10102','custom99',None,'10102')   # 已自訂
    # 一位「不在名單」的舊帳號（轉出的學生）：密碼是自訂的
    q("insert into camp_student_profiles(student_name,password_hash,failed_attempts,is_locked,emergency_contacts) values ('轉學生',camp_hash_password('secret'),0,false,'[]'::jsonb)")
    q("insert into camp_camps(id,data,teacher_pin) values ('c1',%s::jsonb,'1111')",J({"id":"c1","name":"籃球營","season":"summer","term":"115學年度夏令營","dates":["2026-12-05"],"max_capacity":30}))
    for rid,sid in [('r1','10101'),('r2','10102'),('r3','10103'),('rx','99999')]:   # 10103 沒登入過；99999 不在名單
        q("insert into camp_registrations(id,student_id,camp_id,status,created_at) values (%s,%s,'c1','enrolled',now())",rid,sid)
    q("insert into camp_registrations(id,student_id,camp_id,status,created_at) values ('r4','10101','c1','cancelled',now())") if False else None
    q("insert into camp_attendance(camp_id,student_id,attend_date,status) values ('c1','10101','2026-12-05','present'),('c1','99999','2026-12-05','absent')")
    return s,conn,q,one

def verify_migrated(tag,q,one):
    cols=[r[0] for r in q("select column_name from information_schema.columns where table_name='camp_registrations'")]
    check(f'[{tag}] registrations: student_id gone, student_name+snapshot present','student_id' not in cols and 'student_name' in cols and 'snapshot_student_id' in cols)
    rows={r[0]:(r[1],r[2]) for r in q("select id,student_name,snapshot_student_id from camp_registrations")}
    check(f'[{tag}] mapped by roster, snapshot keeps old id',rows=={'r1':('王小明','10101'),'r2':('李小華','10102'),'r3':('陳大同','10103')},rows)
    check(f'[{tag}] unmapped registration backed up, not lost',one("select count(*) from camp_registrations_unmapped where id='rx'")==1 and one("select count(*) from camp_registrations where id='rx'")==0)
    check(f'[{tag}] attendance converted (PK on name)',[r[0] for r in q("select student_name from camp_attendance")]==['王小明'] and one("select count(*) from camp_attendance_unmapped")==1)
    check(f'[{tag}] FK + unique index + trigger exist',one("select count(*) from pg_constraint where conname='camp_registrations_student_name_fkey'")==1 and one("select count(*) from pg_indexes where indexname='camp_one_live_per_camp'")==1 and one("select count(*) from pg_trigger where tgname='trg_camp_norm_reg_name'")==1)
    check(f'[{tag}] stub profile created for never-logged-in student w/ registration',one("select has_custom_password from camp_student_profiles where student_name='陳大同'") is False)
    hc={r[0]:r[1] for r in q("select student_name,has_custom_password from camp_student_profiles")}
    check(f'[{tag}] has_custom backfill: default=false, custom=true, not-in-roster=true',hc.get('王小明') is False and hc.get('李小華') is True and hc.get('轉學生') is True,hc)

for path in ['standalone 001+002','full new schema.sql']:
    s,conn,q,one=build_v5()
    if path.startswith('standalone'):
        e1=[l for l in s.psql(M1).splitlines() if 'ERROR' in l]; e2=[l for l in s.psql(M2).splitlines() if 'ERROR' in l]
        check('[standalone] 001 runs without errors',e1==[],e1); check('[standalone] 002 runs without errors',e2==[],e2)
        # 重複執行
        check('[standalone] 001+002 idempotent',[l for l in s.psql(M1+M2).splitlines() if 'ERROR' in l]==[])
    else:
        e=[l for l in s.psql(schema_text()).splitlines() if 'ERROR' in l]
        check('[full] new schema.sql on v5 DB: no errors',e==[],e)
        check('[full] second run idempotent',[l for l in s.psql(schema_text()).splitlines() if 'ERROR' in l]==[])
    tag='standalone' if path.startswith('standalone') else 'full'
    verify_migrated(tag,q,one)
    if tag=='full':
        # 遷移後，新版函式對「遷移過來的帳號」是否正常
        login=lambda n,p,i=None: one("select camp_verify_student_login(%s,%s,%s)",n,p,i)
        check('[full] default-password student logs in with current id after migration',login('王小明','10101','10101')['success'] is True)
        check('[full] custom-password student keeps custom password; id rejected',login('李小華','custom99','10102')['success'] is True and login('李小華','10102','10102')['success'] is False)
        check('[full] stub profile student can log in with id (default)',login('陳大同','10103','10103')['success'] is True)
        one("select camp_admin_sync_roster(%s,%s::jsonb)",ADMIN,J([{"student_id":"20101","student_name":"王小明"},{"student_id":"20102","student_name":"李小華"},{"student_id":"20103","student_name":"陳大同"}]))
        check('[full] promotion: default users follow new id, custom stays',login('王小明','20101','20101')['success'] is True and login('李小華','custom99','20102')['success'] is True)
        ro=one("select camp_teacher_get_roster('c1','1111')")
        check('[full] teacher roster after migration lists names',ro['success'] is True and sorted(r['student_name'] for r in ro['roster'])==['李小華','王小明','陳大同'])
print('\nFAILED:',fails if fails else 'none')

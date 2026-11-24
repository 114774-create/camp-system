# 在真的 Postgres 上驗證：全新安裝、重複執行、預設密碼分流、報名／點名以姓名為鍵、各種防護
import sys, os, json; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import *
import psycopg2
s=server(); conn=psycopg2.connect(s.get_uri()); conn.autocommit=True; cur=conn.cursor()
def q(sql,*a):
    cur.execute(sql,a or None)
    try: return cur.fetchall()
    except psycopg2.ProgrammingError: return None
def one(sql,*a): return q(sql,*a)[0][0]
def errs(sql): return [l for l in s.psql(sql).splitlines() if 'ERROR' in l]
fails=[]
def check(name,cond,extra=''):
    print(('PASS' if cond else 'FAIL'),name,('' if cond else extra)); 
    if not cond: fails.append(name)
sql=schema_text()
check('fresh install: no errors', errs(sql)==[])
e=errs(sql); check('re-run schema.sql (idempotent): no errors', e==[], e)
ADMIN='2026'; J=lambda x: json.dumps(x,ensure_ascii=False)
r=one("select camp_admin_sync_roster(%s,%s::jsonb)",ADMIN,J([{"student_id":"10101","student_name":"王 小明"},{"student_id":"10102","student_name":"李小華"}]))
check('sync roster',r['count']==2 and r['duplicates']==[])
check('roster names normalized',one("select student_name from camp_roster where student_id='10101'")=='王小明')
login=lambda n,p,i=None: one("select camp_verify_student_login(%s,%s,%s)",n,p,i)
check('first login with default id',login('王 小明','10101','10101')['success'] is True)
check('profile has_custom_password=false',one("select has_custom_password from camp_student_profiles where student_name='王小明'") is False)
check('spoofed first login rejected, no row',login('陳假人','55555','55555')['success'] is False and one("select count(*) from camp_student_profiles where student_name='陳假人'")==0)
one("select camp_admin_sync_roster(%s,%s::jsonb)",ADMIN,J([{"student_id":"20101","student_name":"王小明"},{"student_id":"10102","student_name":"李小華"}]))
check('after promotion: NEW id works',login('王小明','20101','20101')['success'] is True)
check('after promotion: OLD id rejected',login('王小明','10101','20101')['success'] is False)
check('spoof (id not in roster) rejected',login('王小明','99999','99999')['success'] is False)
fa=one("select failed_attempts from camp_student_profiles where student_name='王小明'")
for _ in range(8): login('王小明','99999','99999')
check('spoof attempts not counted / no lockout',one("select failed_attempts from camp_student_profiles where student_name='王小明'")==fa and login('王小明','20101','20101')['success'] is True)
u=one("select camp_update_student_profile(%s,%s,%s,%s::jsonb,%s)",'王小明','20101','mypass',J([{"name":"王大明","relation":"父","phone":"0912345678","is_primary":True}]),'20101')
check('update profile ok',u['success'] is True)
check('has_custom_password=true after change',one("select has_custom_password from camp_student_profiles where student_name='王小明'") is True)
one("select camp_admin_sync_roster(%s,%s::jsonb)",ADMIN,J([{"student_id":"30101","student_name":"王小明"},{"student_id":"10102","student_name":"李小華"}]))
check('custom pwd survives next promotion',login('王小明','mypass','30101')['success'] is True)
check('new id no longer works once custom',login('王小明','30101','30101')['success'] is False)
one("select camp_admin_reset_student_password(%s,%s,%s)",ADMIN,'王小明','30101')
check('admin reset -> has_custom=false',one("select has_custom_password from camp_student_profiles where student_name='王小明'") is False)
check('admin reset: id works, old custom fails',login('王小明','30101','30101')['success'] is True and login('王小明','mypass','30101')['success'] is False)
one("select camp_update_student_profile(%s,%s,%s,%s::jsonb,%s)",'王小明','30101','mypass2',None,'30101')
r=one("select camp_reset_student_password(%s,%s,%s,%s)",'王小明','0912-345678',None,'30101')
check('phone reset w/o pwd -> default',r['success'] is True and one("select has_custom_password from camp_student_profiles where student_name='王小明'") is False and login('王小明','30101','30101')['success'] is True)
r=one("select camp_reset_student_password(%s,%s,%s,%s)",'王小明','0912345678','newpass','30101')
check('phone reset with pwd -> custom',r['success'] is True and one("select has_custom_password from camp_student_profiles where student_name='王小明'") is True and login('王小明','newpass','30101')['success'] is True)
for _ in range(5): one("select camp_reset_student_password(%s,%s,%s,%s)",'王小明','0900000000','xxxx','30101')
check('phone-reset lockout persists (not rolled back)',one("select camp_reset_student_password(%s,%s,%s,%s)",'王小明','0912345678','newpass2','30101').get('locked') is True)
# registrations
q("insert into camp_camps(id,data) values ('c1',%s::jsonb)",J({"id":"c1","name":"籃球營","season":"summer","term":"115學年度夏令營","dates":["2026-12-05","2026-12-12"],"max_capacity":1}))
try: q("insert into camp_registrations(id,student_name,snapshot_student_id,camp_id,status,created_at) values ('r1','王 小明','30101','c1','enrolled',now())"); ok=True
except Exception as e: ok=False; print(e)
check('registration: name normalized by trigger',ok and one("select student_name from camp_registrations where id='r1'")=='王小明')
def fails_with(sql,needle):
    try: q(sql); return False
    except Exception as e: return needle.lower() in str(e).lower()
check('FK: registration needs a profile',fails_with("insert into camp_registrations(id,student_name,camp_id,status,created_at) values ('r2','沒有帳號的人','c1','waitlisted',now())",'foreign key'))
check('unique: one live reg per (name,camp)',fails_with("insert into camp_registrations(id,student_name,camp_id,status,created_at) values ('r3','王小明','c1','waitlisted',now())",'duplicate key'))
check('capacity trigger still works',fails_with("insert into camp_registrations(id,student_name,camp_id,status,created_at) values ('r4','李小華','c1','enrolled',now())",'CAMP_FULL'))
one("select camp_admin_sync_roster(%s,%s::jsonb)",ADMIN,J([{"student_id":"60101","student_name":"畢業生"}])); login('畢業生','60101','60101')
check('graduating-6 trigger (by snapshot id)',fails_with("insert into camp_registrations(id,student_name,snapshot_student_id,camp_id,status,created_at) values ('r5','畢業生','60101','c1','waitlisted',now())",'GRADUATING_BLOCKED'))
# teacher
one("select camp_admin_save_camp(%s,%s::jsonb,%s)",ADMIN,J({"id":"c1","name":"籃球營","season":"summer","term":"115學年度夏令營","dates":["2026-12-05","2026-12-12"],"max_capacity":5}),'4321')
check('PIN not in public data',"teacher_pin" not in json.dumps(one("select data from camp_camps where id='c1'")))
ro=one("select camp_teacher_get_roster('c1','4321')")
check('teacher roster by name',ro['success'] is True and ro['roster'][0]['student_name']=='王小明' and ro['roster'][0]['snapshot_student_id']=='30101')
m=one("select camp_teacher_mark('c1','4321','王 小明','2026-12-05'::date,'present')")
check('teacher mark by spaced name',m['success'] is True and one("select student_name from camp_attendance")=='王小明')
check('teacher mark rejects non-enrolled',one("select camp_teacher_mark('c1','4321','李小華','2026-12-05'::date,'present')")['success'] is False)
for _ in range(8): one("select camp_teacher_get_roster('c1','0000')")
check('teacher PIN lockout persists',one("select camp_teacher_get_roster('c1','4321')")['success'] is False)
print('\nFAILED:',fails if fails else 'none')

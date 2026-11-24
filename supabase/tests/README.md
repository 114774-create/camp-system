# 資料庫測試（選用）

在本機以內建 Postgres 實際執行 `schema.sql` 與遷移檔，不需要 Supabase 帳號。

```bash
pip install pgserver psycopg2-binary
python supabase/tests/test_functions.py   # 全新安裝、重複執行、預設密碼、報名／點名以姓名為鍵…
python supabase/tests/test_migration.py   # v5 資料庫 + 真實資料 → 遷移 001/002
```

注意：Postgres 內建版沒有 pgcrypto，`harness.py` 用簡化函式模擬 `crypt/gen_salt/gen_random_bytes`
（邏輯相同、雜湊強度不同），所以這裡驗證的是「流程與規則」，不是密碼雜湊強度。
`schema_v5_snapshot.sql` 是遷移前（v5）的資料庫結構，僅供 test_migration.py 使用。

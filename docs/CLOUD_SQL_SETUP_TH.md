# Cloud SQL configuration — Bangkok

ตรวจ 10 ตุลาคม 2026: instance `melearn-tutor-db` สถานะ RUNNABLE; project `melearn-infra-prod`, region `asia-southeast3`, PostgreSQL 16 Enterprise, db-f1-micro, SSD 10 GB, ZONAL. Storage auto-increase เปิดโดยจำกัด 20 GB; daily backup เปิด retention 3 ชุด; deletion protection เปิด. ไม่สร้าง instance เพิ่ม.

คำขอสร้างถูกส่งตามคำยืนยันของผู้ใช้ก่อนข้อความให้หยุด และเสร็จแล้วเมื่อมาตรวจ; ผู้ใช้ยืนยันให้ใช้ตัวนี้ต่อ. Runtime API และ application schema ยังไม่ได้สร้าง/เชื่อมจากการมี instance นี้.

## Configuration ที่เตรียมแล้ว

- `GoogleCloud__CloudRunProjectId=melearn-tutor`
- `GoogleCloud__DatabaseProjectId=melearn-infra-prod`
- `GoogleCloud__Region=asia-southeast3`
- `CloudSql__InstanceConnectionName=melearn-infra-prod:asia-southeast3:melearn-tutor-db`
- `ConnectionStrings__Melearn` รอ database/application user/password และ topology ที่ใช้งาน.
- `CloudSql__AdminPassword` เก็บ bootstrap postgres password ใน local `.env` ที่ ignore แล้ว; ไม่แสดงค่าในเอกสาร/log หรือใช้เป็น runtime user.

ชื่อ environment map ไป IConfiguration ผ่าน `__` ตาม ASP.NET Core. ตัวแปร provider/database เป็น configuration เตรียมไว้; ยังไม่มี EF/Npgsql adapter/business API อ่าน connection string หรือทดสอบ query จริง.

## เชื่อมจาก Windows local

ใช้ [Cloud SQL Auth Proxy](https://docs.cloud.google.com/sql/docs/postgres/connect-auth-proxy) และ Application Default Credentials ที่ได้รับ Cloud SQL Client ใน project ของฐานข้อมูล. Proxy ป้องกันการเชื่อมต่อ cloud แต่ยังต้องตรวจ database credentials/grants.

```powershell
gcloud.cmd auth application-default login
.\cloud-sql-proxy.exe --address 127.0.0.1 --port 5433 melearn-infra-prod:asia-southeast3:melearn-tutor-db
```

เมื่อมี database `melearn` และบัญชี `melearn_app` ที่ให้เฉพาะสิทธิ์ runtime จึงกรอก local `.env`:

```dotenv
ConnectionStrings__Melearn=Host=127.0.0.1;Port=5433;Database=melearn;Username=melearn_app;Password=<ค่าจริง>;Maximum Pool Size=5;Minimum Pool Size=0;Timeout=15
```

ตัวอย่างชื่อ database/user เป็นแผน ยังไม่ได้ create หรือ grant. Migration account ต้องแยกจาก runtime; ไม่เปิด schema-write ให้ runtime เพียงเพื่อให้ migration ผ่าน. ห้ามนำ connection string ไป Frontend/VITE. ตรวจ special-character escaping ของ Npgsql connection string เมื่อใส่ password; ข้อมูลตัวอย่างไม่ใช่ credential จริง.

## Cloud Run project melearn-tutor

เมื่อเตรียม deployment: runtime service account ฝั่ง `melearn-tutor` ต้องมี Cloud SQL Client ที่ฝั่ง `melearn-infra-prod`; เปิด Cloud SQL Admin API ทั้งสอง project สำหรับ integration. ฝั่ง infra เปิด API แล้ว; ฝั่ง tutor/IAM ยังไม่ได้เปลี่ยนในชุดนี้.

ผูก instance connection name เข้ากับ Cloud Run และใช้ Unix socket:

```dotenv
ConnectionStrings__Melearn=Host=/cloudsql/melearn-infra-prod:asia-southeast3:melearn-tutor-db;Database=melearn;Username=melearn_app;Password=<secret>;Maximum Pool Size=5;Minimum Pool Size=0;Timeout=15
```

ส่ง runtime password ผ่าน secret configuration ไม่ใส่ image/source. ยังไม่สร้าง Cloud Run service/deploy/change IAM. Region ของ deployment ใช้ Bangkok ตามคำขอล่าสุด; min/max instances และ total pool budget ต้องทดสอบก่อน production.

## ราคาและสิ่งที่ตรวจแล้ว

Cloud Billing Catalog ที่ตรวจ 10 ต.ค. 2026: PostgreSQL Zonal Micro Bangkok SKU `6AE1-4C1F-7DF2`, USD 0.011025/hour → compute ประมาณ USD 8.04825 ต่อ 730 ชั่วโมง. ไม่รวม SSD/backup/IP/network/tax; ไม่ใช้ตัวเลขนี้อ้างเป็น total bill. [Pricing](https://cloud.google.com/sql/pricing), [Catalog API](https://docs.cloud.google.com/billing/docs/how-to/catalog-api).

ตรวจผ่านเฉพาะ SQL Admin API tier availability, creation operation และ instance describe RUNNABLE. ยังไม่ได้ทดสอบ SQL login/query/migrations, Backend persistence หรือ Frontend-to-real-API. ไม่มี local Docker และไม่ได้เปิด authorized network เป็น 0.0.0.0/0. Shared-core ไม่มี SLA.

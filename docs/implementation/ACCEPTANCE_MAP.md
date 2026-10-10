# Acceptance Map — 113 cases

Generated projection จากScope§9 พร้อมsource line; ไม่เปลี่ยนเนื้อหาcaseและไม่ประกาศผ่าน. Mappingระดับworkpackage; 1caseอาจต้องหลายtaskและINTEGRATION-03ตรวจรวม.

| ID | Scope line | Implementation tasks | Action | Expected | Evidence |
| --- | --- | --- | --- | --- | --- |
| A01 | 1462 | AUTH-02, ENROLL-01, LEARN-01, PAY-01, REDEEM-02 | สมัครด้วยอีเมลแล้ว Enroll ก่อนยืนยัน | ปฏิเสธ หลังยืนยันจึงลงเรียนได้ | NOT_VERIFIED |
| A02 | 1463 | PROVIDER-AUTH-01, ENROLL-01 | เข้าด้วย Google ที่ server ตรวจแล้ว | ใช้บัญชีและลงเรียนได้โดยไม่ยืนยันอีเมลซ้ำ | NOT_VERIFIED |
| A03 | 1464 | ACCOUNT-01 | Learner ส่ง Role=Admin/Instructor ในข้อมูล Profile | ไม่เพิ่มสิทธิ์ | NOT_VERIFIED |
| A04 | 1465 | MGMT-02 | Instructor พยายามเพิ่ม Instructor | ปฏิเสธ Admin ทำได้และมีประวัติ | NOT_VERIFIED |
| A05 | 1466 | COURSE-02, MGMT-03, GRADE-01 | Instructor A แก้ Course/Chapter/Quiz ของ B | ปฏิเสธ แม้ A ลงเรียนคอร์ส B แล้ว | NOT_VERIFIED |
| A06 | 1467 | LEARN-01, LEARN-02, ASSESS-01, ASSESS-02, ENROLL-01 | ผู้เรียน A อ่าน/แก้ Progress หรือ Attempt ของ B | ปฏิเสธ ไม่คืนข้อมูลส่วนตัวของ B | NOT_VERIFIED |
| A07 | 1468 | MGMT-01, AUTH-01, ENROLL-01, REDEEM-02 | Admin สร้าง Username/Password โดยไม่มีอีเมล | Login และ Enroll/Redeem ได้ทันทีตามสิทธิ์คอร์ส | NOT_VERIFIED |
| A08 | 1469 | MGMT-01 | Learner/Instructor พยายามสร้างบัญชีแบบ Admin หรือสร้าง Username ซ้ำ | ปฏิเสธ ไม่ได้สิทธิ์สร้างบัญชีแทนและไม่มี Username ซ้ำ | NOT_VERIFIED |
| A09 | 1470 | PROVIDER-AUTH-01, ACCOUNT-01, LEARN-01, ASSESS-02, CERT-01 | บัญชี Admin สร้างเชื่อม Google แล้ว Logout/Login ด้วย Google | กลับ User เดิม Role คอร์ส Progress คะแนน และใบรับรองเดิมยังอยู่ | NOT_VERIFIED |
| A10 | 1471 | PROVIDER-AUTH-01 | เชื่อม Google ที่ผูกกับ User อื่นอยู่ | ปฏิเสธ ไม่รวมบัญชีหรือย้ายผลเรียน | NOT_VERIFIED |
| A11 | 1472 | AUTH-03, AUTH-01 | ผู้มีอีเมลยืนยันขอ Reset แล้วใช้ลิงก์ตั้งรหัสใหม่ | ส่งอีเมลจริง ตั้งรหัสใหม่ได้ รหัสเก่าใช้ Login ไม่ได้ | NOT_VERIFIED |
| A12 | 1473 | AUTH-03 | ใช้ลิงก์ Reset ซ้ำ หมดอายุ หรือแก้หลักฐาน | ปฏิเสธ ไม่เปลี่ยนรหัสผ่าน | NOT_VERIFIED |
| A13 | 1474 | AUTH-03, PROVIDER-AUTH-01 | บัญชีไม่มีอีเมลขอ Reset ทางอีเมล | ไม่ส่งให้ผู้รับที่ไม่ยืนยัน ต้องเพิ่ม/ยืนยันอีเมลหรือเชื่อม Google ก่อนใช้ช่องทางนี้ | NOT_VERIFIED |
| A14 | 1475 | AUTH-02, AUTH-03 | ส่งอีเมลขัดข้อง | มีผลล้มเหลวให้ตรวจ ไม่รายงานว่ายืนยันอีเมลหรือ Reset แล้ว | NOT_VERIFIED |
| A15 | 1476 | AUTH-01, AUTH-02, PROVIDER-AUTH-01 | ตรวจวิธี Login รอบแรก | มี Username/อีเมลและ Google ยังไม่มี LINE | NOT_VERIFIED |
| A16 | 1477 | PROVIDER-AUTH-01 | Google Email ตรง User เดิมแต่ยังไม่เชื่อม | ให้ Login เดิมก่อน Link Google ไม่รวมบัญชีหรือสร้าง User เพิ่ม | NOT_VERIFIED |
| A17 | 1478 | AUTH-02 | สมัครอีเมลและกดลิงก์ภายใน 24 ชั่วโมง | ได้ Verification Link ทาง Resend ไม่ใช้ OTP; User เดิม email_verified=true | NOT_VERIFIED |
| A18 | 1479 | AUTH-02 | ลิงก์ Verification หมดอายุหรือไม่ถูกต้อง | ไม่ยืนยัน ให้ขอลิงก์ใหม่เมื่อหมดอายุ | NOT_VERIFIED |
| A19 | 1480 | AUTH-02 | เปิดลิงก์ Verification ที่ใช้แล้วซ้ำ/พร้อมกัน | ไม่ยืนยันซ้ำ ไม่สร้าง User และไม่เพิ่มผลธุรกิจซ้ำ | NOT_VERIFIED |
| A20 | 1481 | AUTH-02 | ขอ Resend Verification Email ถี่เกินขีดจำกัด | จำกัดการส่ง แจ้งสถานะที่เหมาะสม | NOT_VERIFIED |
| C01 | 1487 | COURSE-01, COURSE-02 | Instructor สร้างคอร์สและบทหลายรายการ | บันทึกจริง เปิดกลับมาเห็นข้อมูลและลำดับเดิม | NOT_VERIFIED |
| C02 | 1488 | COURSE-01, COURSE-02 | Admin สร้าง/แก้คอร์สแทน | Course มี Instructor คนเดียว แยกผู้สร้าง Admin ได้ | NOT_VERIFIED |
| C03 | 1489 | REVIEW-02 | Instructor เผยแพร่ Draft โดยตรง | ปฏิเสธ | NOT_VERIFIED |
| C04 | 1490 | COURSE-02, REVIEW-01, REVIEW-02 | ส่งตรวจ Admin ส่งกลับพร้อมเหตุผล แล้วส่งใหม่ | สถานะและเหตุผลถูกต้อง ประวัติเดิมยังอยู่ | NOT_VERIFIED |
| C05 | 1491 | REVIEW-02, CATALOG-01 | Admin อนุมัติแล้ว Instructor เผยแพร่ | Published และแสดงใน Catalog | NOT_VERIFIED |
| C06 | 1492 | REVIEW-02 | Admin ตรวจ อนุมัติ และเผยแพร่แทน | ทำได้ เก็บผู้อนุมัติ/ผู้เผยแพร่และเวลา | NOT_VERIFIED |
| C07 | 1493 | COURSE-02, REVIEW-02 | ข้อมูลเปลี่ยนระหว่าง Admin เปิดตรวจ | แจ้งให้ตรวจข้อมูลล่าสุด ไม่อนุมัติผิดฉบับเงียบ ๆ | NOT_VERIFIED |
| C08 | 1494 | COURSE-02, LEARN-01 | Instructor แก้เนื้อหา Published | ผู้เรียนเห็นข้อมูลที่แก้ได้ทันที ไม่รออนุมัติใหม่ | NOT_VERIFIED |
| C09 | 1495 | CATALOG-01, COURSE-02 | สาธารณะเปิด Catalog/API ของ Draft หรือเฉลย | ไม่ได้ข้อมูลจำกัดสิทธิ์ | NOT_VERIFIED |
| C10 | 1496 | COURSE-02 | ส่ง Item ของคอร์ส B มาแก้ผ่าน URL คอร์ส A | ปฏิเสธ แม้มีสิทธิ์แก้ A | NOT_VERIFIED |
| C11 | 1497 | COURSE-02, REVIEW-02 | แก้ข้อมูล/บท/Quiz ของ Approved ก่อน Publish | กลับ Draft ต้องตรวจฉบับใหม่ ใช้ Approval เก่าเผยแพร่ไม่ได้ | NOT_VERIFIED |
| V01 | 1498 | COURSE-02, LEARN-01 | ใส่ YouTube Link ใน Video แล้วบันทึกและเปิดหน้าเรียน | ลิงก์และแหล่ง youtube อยู่ครบ เล่นได้ตามการตั้งค่าของ YouTube และตรวจสิทธิ์เข้าเรียน | NOT_VERIFIED |
| V02 | 1499 | VIDEO-01 | กด Upload Video หรือเรียก Upload API ตรง | ตอบ “ขออภัย ระบบนี้ยังไม่พร้อมใช้งาน” ไม่สร้างไฟล์/Upload record หรือทับ YouTube Link; ไม่กระทบภาพปก/ภาพคำตอบ | NOT_VERIFIED |
| V03 | 1500 | COURSE-02, LEARN-01, LEARN-02 | ลิงก์ผิด วิดีโอถูกลบ หรือไม่อนุญาตให้ฝัง | แจ้งข้อผิดพลาด ไม่อ้างว่าเล่นได้และไม่เพิ่ม Progress เอง | NOT_VERIFIED |
| C12 | 1501 | REVIEW-01, AUTH-01 | ตรวจคอร์ส pending_review | Admin เห็นในคิวตรวจ สถานะนี้ไม่ระงับ Login ของเจ้าของคอร์ส | NOT_VERIFIED |
| E01 | 1507 | ENROLL-01 | Enroll คอร์สฟรี แล้วกดซ้ำ | เรียนได้ มี Enrollment เดียว | NOT_VERIFIED |
| E02 | 1508 | ENROLL-01 | เรียก Free Enroll กับคอร์สเสียเงิน | ปฏิเสธ ไม่ได้สิทธิ์ | NOT_VERIFIED |
| E03 | 1509 | REDEEM-02, COURSE-02, GRADE-01 | Instructor Redeem คอร์สคนอื่น | ได้สิทธิ์เรียน แต่ไม่ได้ Editor/คิวตรวจงาน | NOT_VERIFIED |
| E04 | 1510 | REDEEM-02 | Instructor Redeem คอร์สตนเอง หรือ Admin Redeem | ปฏิเสธ รหัสยังไม่ถูกใช้ | NOT_VERIFIED |
| E05 | 1511 | REDEEM-01, REDEEM-02 | Admin ออกโค้ดและผู้เรียนใช้สำเร็จ | ผูกคอร์สถูกต้อง ระบุ User และเวลาใช้ | NOT_VERIFIED |
| E06 | 1512 | REDEEM-02 | ใช้รหัสไม่มีอยู่หรือ Used/Revoked | ไม่ได้สิทธิ์ใหม่ | NOT_VERIFIED |
| E07 | 1513 | REDEEM-02 | สองบัญชีใช้รหัสเดียวกันพร้อมกัน | สำเร็จคนเดียว อีกคนไม่ถูกสร้าง Enrollment จากรหัสนี้ | NOT_VERIFIED |
| E08 | 1514 | REDEEM-02 | บันทึกสิทธิ์ล้มเหลวระหว่าง Redeem | ไม่ทิ้งรหัส Used ที่ไม่มีสิทธิ์ ลองใหม่ได้ตามผลจริง | NOT_VERIFIED |
| E09 | 1515 | REDEEM-02 | มี Enrollment อยู่แล้วและ Redeem รหัสใหม่ของคอร์สเดิม | คืนสิทธิ์เดิม ไม่ใช้รหัสเพิ่ม | NOT_VERIFIED |
| E10 | 1516 | REDEEM-02, ENROLL-01 | ใช้โค้ดที่ออกไว้นาน และกลับมาเรียนหลังลงเรียนไปนาน | ไม่มีเงื่อนไขหมดอายุทั้งโค้ดและสิทธิ์เรียน | NOT_VERIFIED |
| E11 | 1517 | REDEEM-01, REDEEM-02 | Admin ยกเลิก Unused | เป็น Revoked มีผู้ทำ/เวลา แลกไม่ได้ | NOT_VERIFIED |
| E12 | 1518 | REDEEM-01, REDEEM-02 | Admin ยกเลิก Used | ปฏิเสธ สิทธิ์เรียนและใบรับรองเดิมยังอยู่ | NOT_VERIFIED |
| E13 | 1519 | REDEEM-01, REDEEM-02 | ยกเลิก Unused พร้อมกับ Redeem | สำเร็จได้หนึ่งทาง ไม่เกิดทั้ง Revoked และให้สิทธิ์จากรหัสเดียวกัน | NOT_VERIFIED |
| P01 | 1525 | PAY-01, PROVIDER-STRIPE-01 | บัญชีพร้อมซื้อคอร์ส Published ผ่าน Stripe สำเร็จ | Backend ตรวจ Webhook แล้วสร้าง Enrollment source stripe โดยไม่รอ Admin/ไม่ใช้โค้ด เข้าเรียนได้ตลอด | NOT_VERIFIED |
| P02 | 1526 | PAY-01 | Admin หรือ Instructor ซื้อคอร์สตนเอง; สมัครอีเมลยังไม่ยืนยัน | ปฏิเสธก่อนสร้าง Session; บัญชีที่ Admin สร้างเรียนได้ทันทีตามข้อยกเว้น | NOT_VERIFIED |
| P03 | 1527 | PAY-01, PAY-02, PROVIDER-STRIPE-01 | แก้ราคา course_id payment_id หรือสถานะใน Request/URL | ใช้ราคาจาก server เข้าถึงเฉพาะ Payment ของตน ไม่ได้สิทธิ์ผิดคอร์สหรือจากสถานะปลอม | NOT_VERIFIED |
| P04 | 1528 | PAY-01, PROVIDER-STRIPE-01 | จ่ายไม่สำเร็จ กดกลับ Session หมดอายุ หรือยังรอผล | แสดงผลตาม Stripe/server ยังไม่ให้สิทธิ์ใหม่; browser ยกเลิกอย่างเดียวไม่ทับผลจ่ายสำเร็จ | NOT_VERIFIED |
| P05 | 1529 | PAY-01, PROVIDER-STRIPE-01 | จ่ายแล้วปิด browser ก่อนกลับจาก Stripe | Webhook ให้สิทธิ์ได้ เปิดบัญชีเดิมแล้วเรียนต่อได้ | NOT_VERIFIED |
| P06 | 1530 | PAY-01, PROVIDER-STRIPE-01 | ส่ง Webhook ปลอม ส่งซ้ำ หรือสองแท็บอ่านสถานะพร้อมกัน | ปฏิเสธลายเซ็นผิด; Webhook จริงให้สิทธิ์หนึ่งครั้ง ไม่มี Payment หรือ Enrollment ซ้ำ; GET ไม่ให้สิทธิ์ | NOT_VERIFIED |
| P07 | 1531 | PAY-01, PROVIDER-STRIPE-01 | จ่ายสำเร็จแต่บันทึกสิทธิ์ล้มเหลว | เก็บ Succeeded และ fulfillment failed ลองให้สิทธิ์ต่อได้โดยไม่เก็บเงินใหม่ | NOT_VERIFIED |
| P08 | 1532 | PAY-01, PROVIDER-STRIPE-01, REDEEM-02 | Redeem สำเร็จระหว่างรอผลจ่าย หรือมี Payment จ่ายซ้ำจริง | ใช้ Enrollment เดิม เก็บผลเงินทุกรายการ ไม่ใช้โค้ดเพิ่ม ไม่สร้าง Refund policy อัตโนมัติ | NOT_VERIFIED |
| P09 | 1533 | PAY-01, PROVIDER-STRIPE-01 | เปลี่ยนราคาคอร์สหลังเริ่มจ่าย / กดซื้อซ้ำขณะ Session ยังเปิด | ตรวจจากราคา Snapshot เดิม; การลอง request เดิมไม่สร้างการเก็บเงินใหม่ทุกครั้ง | NOT_VERIFIED |
| P10 | 1534 | PAY-01, PROVIDER-STRIPE-01 | เปิด Success Page หรือเติม status=success ใน URL ก่อน Webhook มาถึง | อ่านสถานะ Pending/Processing จาก Backend ไม่สร้างสิทธิ์และไม่มีปุ่มเริ่มเรียน; หลัง Webhook สำเร็จจึงแสดงสิทธิ์ | NOT_VERIFIED |
| P11 | 1535 | PAY-01, PROVIDER-STRIPE-01 | Frontend ส่งราคาหรือ User ID ที่แก้เองในคำขอ Checkout | Backend ใช้ตัวตนจาก session และราคาปัจจุบันของ Course เท่านั้น ปฏิเสธหรือไม่ใช้ค่าที่ไม่ได้อยู่ใน contract | NOT_VERIFIED |
| P12 | 1536 | PAY-01, PROVIDER-STRIPE-01, REDEEM-02 | Redeem สำเร็จก่อน Webhook ของ Payment เดิม | เชื่อม Payment กับ Enrollment เดิม ไม่สร้างสิทธิ์ซ้ำและไม่เขียนทับ source redeem | NOT_VERIFIED |
| Q01 | 1542 | LEARN-02 | กดเรียนจบวิดีโอ/บทอ่าน แล้วกดซ้ำ | Completed หนึ่งรายการ ไม่เพิ่มยอดซ้ำ | NOT_VERIFIED |
| Q02 | 1543 | LEARN-01, LEARN-02 | ออกจากระบบ/เปลี่ยนอุปกรณ์แล้วเปิดคอร์ส | ความคืบหน้าและข้อมูลกลับมาเรียนต่อยังอยู่ | NOT_VERIFIED |
| Q03 | 1544 | ASSESS-01 | ทำครบคำตอบแต่ได้คะแนน 70% | ไม่ผ่าน ยังไม่นับ Quiz เป็น Completed | NOT_VERIFIED |
| Q04 | 1545 | ASSESS-01, GRADE-01, LEARN-02, COMPLETION-01 | ทำครบคำตอบและได้คะแนนมากกว่า 70% | ผ่าน เมื่อคะแนนทุกข้อเสร็จแล้ว | NOT_VERIFIED |
| Q05 | 1546 | GRADE-01, CERT-01, ASSESS-01, COMPLETION-01 | Choice ผ่าน แต่ข้อเขียน/ภาพยังรอตรวจ | ยังไม่สรุปผ่านจากผลครั้งนั้น ไม่ออกใบรับรองก่อนครบ | NOT_VERIFIED |
| Q06 | 1547 | ASSESS-02, GRADE-01, ASSESS-01, COMPLETION-01 | ครั้งแรกได้ 80% ครั้งถัดไปได้ 60% | ใช้ 80% และยังผ่าน | NOT_VERIFIED |
| Q07 | 1548 | ASSESS-02, GRADE-01, ASSESS-01, COMPLETION-01 | ครั้งแรกได้ 60% ครั้งถัดไปได้ 90% | ใช้ 90% และเปลี่ยนเป็นผ่าน | NOT_VERIFIED |
| Q08 | 1549 | COURSE-02, ASSESS-01 | เริ่ม Attempt แล้วผู้สอนแก้โจทย์/คะแนนเต็ม | ครั้งเดิมใช้ชุดที่เก็บไว้ ครั้งใหม่ใช้ชุดปัจจุบัน | NOT_VERIFIED |
| Q09 | 1550 | ASSESS-01 | ส่ง Score=100/Passed=true จากหน้าเว็บ | server คิดจากคำตอบจริง ไม่เชื่อค่าที่ส่ง | NOT_VERIFIED |
| Q10 | 1551 | ASSESS-01 | ส่งคำตอบซ้ำหรือบันทึกทับหลังส่งแล้ว | ไม่สร้าง Attempt ใหม่ และแก้คำตอบที่ส่งแล้วไม่ได้ | NOT_VERIFIED |
| Q11 | 1552 | GRADE-01 | Instructor ตรวจคำตอบคอร์สคนอื่น/ให้คะแนนเกินเต็ม | ปฏิเสธ | NOT_VERIFIED |
| Q12 | 1553 | LEARN-02, COMPLETION-01, LEARN-01 | คอร์สยังเหลือหนึ่งรายการแต่เปอร์เซ็นต์ปัดใกล้ 100 | ยังไม่แสดง 100% และยังไม่จบ | NOT_VERIFIED |
| F01 | 1559 | COMPLETION-01, CERT-01 | เนื้อหาและแบบฝึกหัดผ่านครบ | Progress 100% ออกใบรับรองอัตโนมัติ | NOT_VERIFIED |
| F02 | 1560 | COMPLETION-01, CERT-01 | Refresh/เรียกตรวจจบซ้ำ/ดาวน์โหลดหลายครั้ง | ใบรับรองเดิม ไม่ออกใบซ้ำ | NOT_VERIFIED |
| F03 | 1561 | LEARN-01, LEARN-02, COURSE-02, COMPLETION-01 | Admin/เจ้าของเปิดดูเนื้อหาครบ | ไม่สร้างผลเรียนหรือใบรับรองอัตโนมัติ | NOT_VERIFIED |
| F04 | 1562 | COURSE-02, CERT-01, COMPLETION-01 | เพิ่มบทเรียนหลังผู้เรียนได้ใบรับรองแล้ว | สถานะจบและใบเดิมยังอยู่ เรียนเพิ่มเป็นทางเลือก | NOT_VERIFIED |
| F05 | 1563 | COURSE-02, LEARN-02, COMPLETION-01 | เพิ่มบทเรียนก่อนผู้เรียนจบ | ผู้เรียนยังต้องครบรายการปัจจุบัน | NOT_VERIFIED |
| F06 | 1564 | CERT-01 | บัญชีอื่นอ่าน/ดาวน์โหลดใบรับรองของผู้เรียน | ปฏิเสธ | NOT_VERIFIED |
| F07 | 1565 | CERT-01 | สร้างไฟล์ใบรับรองขัดข้องแล้วลองใหม่ | ออกจากผลจบเดิมได้ ไม่ต้องเรียนใหม่ ไม่สร้างใบซ้ำ | NOT_VERIFIED |
| F08 | 1566 | COURSE-02, COMPLETION-01, CERT-01 | จบ 100% แล้วเพิ่มบท/แก้แบบฝึกหัด | completed_at และ completion_snapshot เดิมยังอยู่ ใช้อธิบายผลจบเดิมได้ | NOT_VERIFIED |
| B01 | 1572 | BLOG-01, BLOG-02 | Admin สร้าง Draft และดูตัวอย่าง | ข้อมูล/ภาพ/รูปแบบยังอยู่ สาธารณะยังอ่าน Draft ไม่ได้ | NOT_VERIFIED |
| B02 | 1573 | BLOG-02, BLOG-03, BLOG-01 | Admin Publish บทความ | Guest และทุกบทบาทอ่าน Published ได้ | NOT_VERIFIED |
| B03 | 1574 | BLOG-03, BLOG-02 | Learner/Instructor เรียกคำสั่งเขียน แก้ หรือ Publish Blog | ปฏิเสธ แม้เป็น Instructor ที่แก้บทอ่านในคอร์สได้ | NOT_VERIFIED |
| B04 | 1575 | BLOG-02, BLOG-01 | Admin แก้ Published แล้วบันทึก | บทความแสดงข้อมูลใหม่ ไม่กระทบ Progress หรือใบรับรอง | NOT_VERIFIED |
| AI01 | 1581 | AI-01 | Admin เปิด/ปิด ai_enabled และ Refresh | ค่าอยู่ครบ ปิดแล้วเรียนตามปกติ Transcript เดิมยังอยู่ | NOT_VERIFIED |
| AI02 | 1582 | AI-01 | Learner/Instructor เรียกคำสั่งตั้งค่า AI หรือแก้ Transcript รวมการแอบส่งผ่าน Editor ปกติ | ปฏิเสธช่อง Admin-only โดยไม่ลบ Transcript เดิม | NOT_VERIFIED |
| AI03 | 1583 | AI-01 | Admin วาง Plain Text ยาวพร้อม Timestamp แล้ว Save/เปิดใหม่/แทนที่ | ข้อความ บรรทัด Timestamp และ Video/Chapter/Course ถูกต้อง | NOT_VERIFIED |
| AI04 | 1584 | AI-01 | แก้ Transcript หรือสวิตช์ AI | Progress, Quiz, Enrollment, Certificate และ Approval ไม่เปลี่ยน | NOT_VERIFIED |
| AI05 | 1585 | AI-01, CATALOG-01, LEARN-01, COURSE-02 | ผู้เรียนเปิดหน้าเรียน Catalog Preview และ API เนื้อหา | ไม่เห็น Raw Transcript ทั้งหมดหรือช่องแก้ Transcript | NOT_VERIFIED |
| AI06 | 1586 | AI-03 | คอร์สเปิด AI แต่บางวิดีโอไม่มี Transcript | ใช้ Description, Article และ Transcript ที่มี ถามได้โดยไม่บังคับมี Transcript ทุกวิดีโอ | NOT_VERIFIED |
| AI07 | 1587 | AI-03 | ถามเรื่องที่ไม่มีข้อมูลรองรับ | แจ้งว่า Knowledge ไม่พอ ไม่อ้างว่ามีเนื้อหานั้นในคอร์ส | NOT_VERIFIED |
| AI08 | 1588 | AI-03 | ปิด AI แล้วใช้แชตเดิม URL เดิม หรือเปลี่ยน Course ID ไปคอร์สที่ไม่มีสิทธิ์ | ไม่ใช้ Knowledge ที่ปิดหรือไม่ได้รับสิทธิ์ | NOT_VERIFIED |
| AI09 | 1589 | AI-01, COURSE-02 | Save Transcript ขณะที่ Video/Quiz มีฉบับร่างยังไม่บันทึก | บันทึกเฉพาะ Transcript ฉบับร่างการเรียนไม่ถูกบันทึกหรือทิ้งโดยเงียบ ๆ | NOT_VERIFIED |
| AI10 | 1590 | AI-01, COURSE-02 | Instructor แก้ Video fields เดิมหลัง Admin บันทึก Transcript | เนื้อหาการเรียนเปลี่ยนตามสิทธิ์ Transcript ที่เก็บไว้ยังอยู่ | NOT_VERIFIED |
| AI11 | 1591 | AI-02, AI-03 | สร้างหลายแชต ส่งคำถาม แล้ว Refresh/ออกจากระบบ/เข้าอีกอุปกรณ์ | ประวัติคำถามและคำตอบกลับมาได้จาก Database ของบัญชีเดียวกัน | NOT_VERIFIED |
| AI12 | 1592 | AI-02 | ค้นหาประวัติจากชื่อหรือข้อความและเปิดแชต | เห็นเฉพาะแชตตนเอง เรียงกิจกรรมล่าสุด เปิดแล้วข้อความเรียงถูกต้อง | NOT_VERIFIED |
| AI13 | 1593 | AI-05, AI-03 | เปลี่ยนชื่อแชตแล้วส่งคำถามใหม่ | ชื่อใหม่อยู่หลังเปิดใหม่ ไม่ถูกคำถามครั้งต่อไปทับ ชื่อว่างถูกปฏิเสธ | NOT_VERIFIED |
| AI14 | 1594 | AI-05, AI-03 | ลบแชตของตนเองและลบแชตสุดท้าย | ยืนยันก่อนลบ แชตหายจากประวัติ เปิดแชตที่เหลือหรือแชตใหม่ ไม่คืนโควตา | NOT_VERIFIED |
| AI15 | 1595 | AI-02, AI-05, AI-03 | เปลี่ยน Conversation/User ID เพื่ออ่าน เปลี่ยนชื่อ ลบ หรือส่งในแชตผู้อื่น | ปฏิเสธ รวมถึง Admin ที่ไม่มีสิทธิ์ดูคำถามผู้อื่นในรอบนี้ | NOT_VERIFIED |
| AI16 | 1596 | AI-03 | ถามสำเร็จในหลายคอร์ส/หลายแชตจนรวม 20 ครั้ง | ทุกบทบาทใช้ยอดเดียวต่อบัญชี ครั้งที่ 21 ไม่เรียก AI และแจ้งเวลาเริ่มใหม่ | NOT_VERIFIED |
| AI17 | 1597 | AI-03 | AI ล้มเหลว หมดเวลา หรือส่งไม่ผ่านสิทธิ์ | ไม่เพิ่ม success_count คำขอที่ server รับแล้วมีสถานะติดตาม และคืนสิทธิ์ชั่วคราวเมื่อยุติ | NOT_VERIFIED |
| AI18 | 1598 | AI-03 | ส่ง request_id เดิมซ้ำ หรือ browser หลุดหลัง server ตอบแล้ว | กลับมาอ่านผลเดิมได้ คำถาม/คำตอบและจำนวนสำเร็จไม่ซ้ำ | NOT_VERIFIED |
| AI19 | 1599 | AI-03 | เหลือโควตาหนึ่งครั้งแล้วส่งพร้อมกันจากสองแท็บ | สำเร็จได้ไม่เกินหนึ่งครั้ง ไม่ทะลุ 20 และไม่แจ้งใช้ครบจากการนับที่ browser เอง | NOT_VERIFIED |
| AI20 | 1600 | AI-03 | ใช้ครบก่อนเที่ยงคืนไทย แล้วส่งคำขอใหม่หลัง 00:00 น. | ใช้โควตาวันใหม่ได้ ประวัติและยอดวันก่อนยังอยู่ คำขอค้างใช้ usage_date เดิม | NOT_VERIFIED |
| AI21 | 1601 | AI-03, ASSESS-02 | เลือกคอร์สด้วย `/` แล้วเปลี่ยนคอร์สหรือเลือกบริบทแบบฝึกหัด | ฉบับร่างคำถามไม่หาย ข้อความเก่ายังอ้างบริบทเดิม ไม่มีเฉลย Editor หลุดมา | NOT_VERIFIED |
| AI22 | 1602 | AI-03, AI-04 | ตอบเป็นสมการหรือโจทย์ฝึกให้ลองเลือกในแชต | แสดงตาม renderer ได้ ผลตอบในแชตไม่เพิ่ม Quiz score, Progress หรือ Certificate | NOT_VERIFIED |
| AI23 | 1603 | AI-02, AI-03 | ตรวจข้อมูลคำถาม/คำตอบใน Database และเปลี่ยนชื่อแชต | User/Conversation/Message ID เวลา บริบท request_id และสถานะตรงกัน ชื่อใหม่ไม่เปลี่ยนการเชื่อมข้อมูล ไม่มีหน้า Big Data/Admin วิเคราะห์เพิ่มในรอบนี้ | NOT_VERIFIED |
| AI24 | 1609 | AI-03, AI-04 | ส่ง “สร้างแบบฝึกหัดเศษส่วน 5 ข้อ” หรือ `/quiz เศษส่วน 5 ข้อ` | AI สร้างโจทย์เลือกตอบตามคำสั่ง แสดงและตอบในแชต ไม่ขอ PDF | NOT_VERIFIED |
| AI25 | 1610 | AI-03, AI-04 | เลือกคอร์สที่มีสิทธิ์แล้วสั่งสร้าง; แอบใช้ Course ID ที่ไม่มีสิทธิ์/ปิด AI | ใช้ Knowledge เฉพาะที่ผ่านสิทธิ์ คอร์สที่ไม่ผ่านไม่ถูกใช้ ไม่อ้างข้อมูลคอร์สที่ไม่มีรองรับ | NOT_VERIFIED |
| AI26 | 1611 | AI-03, AI-04 | AI ให้โจทย์ผิดรูปแบบหรือบันทึกชุดฝึกไม่ได้ | Failed ไม่คิด Prompt สำเร็จ ไม่แสดงชุดฝึกที่ตอบไม่ได้ | NOT_VERIFIED |
| AI27 | 1612 | AI-03, AI-04 | สร้างชุดสำเร็จ ตอบ อ่านผล ลองตอบซ้ำ แล้วเปิดแชตเดิม | สร้างใช้หนึ่ง Prompt; การตอบ/อ่านไม่เพิ่มโควตา เก็บโจทย์เดิมและผลล่าสุดใน Database | NOT_VERIFIED |
| AI28 | 1613 | AI-03, AI-04 | ตอบชุดฝึกครบและได้คะแนนเต็ม | มีผลรวมพร้อมคำอธิบาย แต่ QuizAttempt/Progress/Certificate ไม่เปลี่ยน | NOT_VERIFIED |
| AI29 | 1614 | AI-03, AI-04 | เปิด/ตอบชุดฝึกของบัญชีอื่น หรือส่ง question/option ID ปลอม | ปฏิเสธ ไม่เปิดข้อมูลหรือบันทึกคะแนนที่ client ปลอม | NOT_VERIFIED |

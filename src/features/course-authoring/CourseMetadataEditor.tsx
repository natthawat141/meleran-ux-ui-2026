import type { ComponentType, ReactNode } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Typography,
  type FormInstance,
} from 'antd';

const { Title } = Typography;

export interface CourseMetadataFormValues {
  title: string;
  subtitle: string;
  description: string;
  outcomesText?: string;
  cover?: string;
  instructorId: string;
  category: string;
  level: string;
  price: number;
  pricingType: 'free' | 'paid';
}

export interface CourseMetadataEditorProps {
  form: FormInstance<CourseMetadataFormValues>;
  initialValues: Partial<CourseMetadataFormValues>;
  isNew: boolean;
  savedCourse?: {
    id: string;
    status: string;
    price: number;
  };
  canAssignInstructor: boolean;
  instructors: Array<{ id: string; name: string }>;
  returnedReason?: string;
  canSubmitForReview: boolean;
  canPublish: boolean;
  adminExtension?: ReactNode;
  defaultCover: string;
  ImageUploadField: ComponentType<{
    value?: string;
    onChange?: (value?: string) => void;
    fallback: string;
  }>;
  StatusTag: ComponentType<{ status: string }>;
  onFinish: (values: CourseMetadataFormValues) => void;
  onSubmitForReview: () => void;
  onPublish: () => void;
  previewAction: ReactNode;
}

export function CourseMetadataEditor({
  form,
  initialValues,
  isNew,
  savedCourse,
  canAssignInstructor,
  instructors,
  returnedReason,
  canSubmitForReview,
  canPublish,
  adminExtension,
  defaultCover,
  ImageUploadField,
  StatusTag,
  onFinish,
  onSubmitForReview,
  onPublish,
  previewAction,
}: CourseMetadataEditorProps) {
  const selectedPricingType =
    Form.useWatch('pricingType', form) ?? (savedCourse?.price ? 'paid' : 'free');

  return (
    <div className="form-page course-form-page">
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={onFinish}
        key={savedCourse?.id ?? 'new'}
      >
        <div className="form-page-grid">
          <div className="course-editor-main">
            <section className="editor-section">
              <div className="course-editor-section-heading">
                <span>01</span>
                <div>
                  <Title level={4}>แนะนำคอร์ส</Title>
                  <p>บอกผู้เรียนว่าคอร์สนี้เกี่ยวกับอะไรและช่วยเขาได้อย่างไร</p>
                </div>
              </div>
              <Form.Item
                name="title"
                label="ชื่อคอร์ส"
                rules={[{ required: true, message: 'กรอกชื่อคอร์ส' }]}
              >
                <Input size="large" maxLength={100} placeholder="ชื่อที่สื่อสารหัวข้อได้ชัดเจน" />
              </Form.Item>
              <Form.Item
                name="subtitle"
                label="คำโปรยสั้น"
                rules={[{ required: true, message: 'สรุปว่าคอร์สนี้ช่วยเรื่องอะไร' }]}
              >
                <Input maxLength={160} placeholder="สรุปสิ่งที่ผู้เรียนจะได้รับในหนึ่งประโยค" />
              </Form.Item>
              <Form.Item
                name="description"
                label="รายละเอียดคอร์ส"
                rules={[{ required: true, message: 'เพิ่มรายละเอียดคอร์ส' }]}
              >
                <Input.TextArea
                  rows={5}
                  placeholder="เล่าว่าจะเรียนเรื่องอะไร เหมาะกับใคร และนำไปใช้ได้อย่างไร"
                />
              </Form.Item>
              <Form.Item
                name="outcomesText"
                label="ผลลัพธ์ที่ผู้เรียนจะได้"
                extra="เขียนหนึ่งข้อในแต่ละบรรทัด"
              >
                <Input.TextArea
                  rows={3}
                  placeholder={'เข้าใจพื้นฐานของหัวข้อ\nลองนำไปใช้กับงานจริง'}
                />
              </Form.Item>
            </section>
            <section className="editor-section">
              <div className="course-editor-section-heading">
                <span>02</span>
                <div>
                  <Title level={4}>ภาพปกคอร์ส</Title>
                  <p>ภาพนี้จะแสดงในหน้ารวมคอร์สและหน้ารายละเอียด</p>
                </div>
              </div>
              <Form.Item name="cover">
                <ImageUploadField fallback={defaultCover} />
              </Form.Item>
            </section>
            <section className="editor-section">
              <div className="course-editor-section-heading">
                <span>03</span>
                <div>
                  <Title level={4}>รายละเอียดเพิ่มเติม</Title>
                  <p>ช่วยให้ผู้เรียนค้นพบคอร์สที่เหมาะกับตัวเอง</p>
                </div>
              </div>
              {canAssignInstructor && (
                <Form.Item
                  name="instructorId"
                  label="ผู้สอนประจำคอร์ส"
                  rules={[{ required: true, message: 'เลือกผู้สอน' }]}
                >
                  <Select
                    options={instructors.map((instructor) => ({
                      value: instructor.id,
                      label: instructor.name,
                    }))}
                  />
                </Form.Item>
              )}
              <div className="course-editor-details">
                <Form.Item name="category" label="หมวดหมู่">
                  <Select
                    options={['การสื่อสาร', 'ข้อมูลและดิจิทัล', 'การทำงาน', 'การออกแบบ'].map(
                      (value) => ({ value })
                    )}
                  />
                </Form.Item>
                <Form.Item name="level" label="ระดับ">
                  <Select options={['เริ่มต้น', 'กลาง', 'ขั้นสูง'].map((value) => ({ value }))} />
                </Form.Item>
                <Form.Item name="pricingType" label="ค่าเรียน">
                  <Radio.Group optionType="button" buttonStyle="solid">
                    <Radio.Button value="free">เรียนฟรี</Radio.Button>
                    <Radio.Button value="paid">มีค่าใช้จ่าย</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                {selectedPricingType === 'paid' && (
                  <Form.Item
                    name="price"
                    label="ราคาคอร์ส"
                    rules={[{ required: true, message: 'กรอกราคาคอร์ส' }]}
                  >
                    <InputNumber
                      min={1}
                      precision={0}
                      step={50}
                      addonAfter="บาท"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                )}
              </div>
            </section>
            {adminExtension}
          </div>
          <aside className="editor-aside course-editor-publish">
            <Title level={5}>การเผยแพร่</Title>
            <p>ส่งตรวจและเผยแพร่ผ่านขั้นตอนอนุมัติของแอดมิน</p>
            <div className="course-publish-note">
              <StatusTag status={savedCourse?.status ?? 'draft'} />
              {savedCourse?.status === 'approved' && <p>คอร์สผ่านการตรวจแล้ว พร้อมเผยแพร่</p>}
              {savedCourse?.status === 'pending_review' && (
                <p>กำลังรอแอดมินตรวจ หากแก้ไขต้องส่งตรวจใหม่</p>
              )}
              {savedCourse?.status === 'published' && <p>คอร์สเผยแพร่แล้ว การแก้ไขจะอัปเดตทันที</p>}
              {(!savedCourse || savedCourse.status === 'draft') && (
                <p>ฉบับร่างยังไม่แสดงให้ผู้เรียนทั่วไปเห็น</p>
              )}
            </div>
            {returnedReason && (
              <Alert
                className="bottom-space"
                type="warning"
                showIcon
                message="เหตุผลที่แอดมินส่งกลับ"
                description={returnedReason}
              />
            )}
            <Button block type="primary" htmlType="submit">
              {isNew ? 'สร้างคอร์ส' : 'บันทึกการเปลี่ยนแปลง'}
            </Button>
            {canSubmitForReview && (
              <Button block className="top-space" onClick={onSubmitForReview}>
                ส่งตรวจคอร์ส
              </Button>
            )}
            {canPublish && (
              <Button block className="top-space" onClick={onPublish}>
                เผยแพร่คอร์ส
              </Button>
            )}
            {savedCourse && previewAction}
          </aside>
        </div>
      </Form>
    </div>
  );
}

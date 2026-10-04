import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { Button, Carousel, Modal, Tag, type CarouselRef } from 'antd';
import { Link } from 'react-router-dom';
import './instructor-spotlight.css';

type Instructor = {
  id: 'mind' | 'ton' | 'praew' | 'nont';
  name: string;
  mockName: string;
  subject: string;
  level: string;
  introduction: string;
  bio: string;
  topics: string[];
};

const instructors: Instructor[] = [
  {
    id: 'mind',
    name: 'ครูมายด์',
    mockName: 'มนัสวี ใจดี',
    subject: 'คณิตศาสตร์',
    level: 'มัธยมต้น · สอบเข้า ม.4',
    introduction: 'ทบทวนพื้นฐานและฝึกคิดเป็นขั้นตอน เพื่อทำโจทย์ได้อย่างมั่นใจ',
    bio: 'ตัวอย่างผู้สอนวิชาคณิตศาสตร์ ชวนทบทวนแนวคิดพื้นฐานและลองแก้โจทย์ทีละขั้น เหมาะกับการเตรียมตัวสอบเข้า ม.4',
    topics: ['จำนวนและพีชคณิต', 'สมการและโจทย์ปัญหา', 'เรขาคณิตพื้นฐาน'],
  },
  {
    id: 'ton',
    name: 'ครูต้น',
    mockName: 'ธนกฤต คิดเป็น',
    subject: 'ฟิสิกส์',
    level: 'มัธยมปลาย · A-Level',
    introduction: 'เชื่อมหลักการกับวิธีทำโจทย์ ให้เห็นที่มาของคำตอบ',
    bio: 'ตัวอย่างผู้สอนฟิสิกส์ ชวนทำความเข้าใจหลักการสำคัญและฝึกเลือกวิธีแก้โจทย์อย่างเป็นระบบ สำหรับเตรียมสอบ A-Level',
    topics: ['กลศาสตร์', 'ไฟฟ้าและคลื่น', 'ฝึกวิเคราะห์โจทย์ A-Level'],
  },
  {
    id: 'praew',
    name: 'ครูแพรว',
    mockName: 'แพรวา วางแผน',
    subject: 'ภาษาอังกฤษ',
    level: 'มัธยมต้น–ปลาย · TGAT',
    introduction: 'ฝึกอ่านจับใจความและเลือกใช้ภาษาให้ตรงกับโจทย์',
    bio: 'ตัวอย่างผู้สอนภาษาอังกฤษ ชวนฝึกทักษะการอ่าน คำศัพท์ และการใช้ภาษา พร้อมทำความคุ้นเคยกับโจทย์แนว TGAT',
    topics: ['Reading comprehension', 'คำศัพท์ในบริบท', 'ฝึกทำโจทย์ TGAT'],
  },
  {
    id: 'nont',
    name: 'ครูนนท์',
    mockName: 'นนทพัทธ์ ตั้งใจ',
    subject: 'วิทยาศาสตร์',
    level: 'มัธยมต้น · สอบเข้า ม.4',
    introduction: 'ทบทวนแนวคิดวิทยาศาสตร์ผ่านตัวอย่างและโจทย์ใกล้ตัว',
    bio: 'ตัวอย่างผู้สอนวิทยาศาสตร์ ชวนเชื่อมโยงเนื้อหาแต่ละเรื่องกับโจทย์ที่พบได้ในการเรียนและการเตรียมสอบเข้า ม.4',
    topics: ['ชีววิทยาและสิ่งมีชีวิต', 'สารและการเปลี่ยนแปลง', 'โลก ดาราศาสตร์ และอวกาศ'],
  },
];

const portraitSheet = '/images/instructors/instructor-mock-cutouts.png';
const singlePortrait = '/images/instructors/instructor-nont-mock.png';
const mobileQuery = '(max-width: 700px)';

export function InstructorSpotlight() {
  const carouselRef = useRef<CarouselRef>(null);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(mobileQuery).matches,
  );
  const reducedMotion = typeof window !== 'undefined'
    && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileQuery);
    const updateViewport = () => setIsMobile(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  const carouselSettings = {
    arrows: false,
    autoplay: false,
    centerMode: isMobile,
    centerPadding: isMobile ? '16%' : '0px',
    draggable: true,
    dots: false,
    infinite: true,
    slidesToShow: isMobile ? 1 : 3,
    slidesToScroll: 1,
    speed: reducedMotion ? 0 : 360,
    swipe: true,
    swipeToSlide: true,
    waitForAnimate: false,
  };

  return (
    <section className="home-container home-teachers" aria-labelledby="home-teachers-title">
      <div className="home-teachers-heading">
        <div>
          <h2 id="home-teachers-title">ผู้สอนของเรา</h2>
          <p>เลือกครูที่ใช่ แล้วเริ่มติววิชาที่อยากมั่นใจ</p>
        </div>
      </div>

      <div className="home-teacher-carousel-wrap">
        <Carousel ref={carouselRef} className="home-teacher-carousel" {...carouselSettings}>
          {instructors.map((instructor, index) => {
            const usesSprite = instructor.id !== 'nont';

            return (
              <article className="home-teacher-slide" key={instructor.id}>
                <div className={`home-teacher-portrait home-teacher-portrait-${instructor.id}`}>
                  <span className="home-teacher-portrait-circle" aria-hidden="true" />
                  <span className="home-teacher-decoration home-teacher-decoration-ring" aria-hidden="true" />
                  <span className="home-teacher-decoration home-teacher-decoration-dots" aria-hidden="true" />
                  <div className={`home-teacher-portrait-window${usesSprite ? '' : ' home-teacher-portrait-window-single'}`}>
                    <img
                      className={`home-teacher-portrait-image home-teacher-portrait-image-${instructor.id}`}
                      src={usesSprite ? portraitSheet : singlePortrait}
                      alt={`ภาพผู้สอนตัวอย่าง ${instructor.name}`}
                      style={usesSprite ? { left: `${index * -100}%` } : undefined}
                      draggable={false}
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="home-teacher-nameband">
                  <strong>{instructor.name}</strong>
                  <span>{instructor.mockName}</span>
                </div>
                <div className="home-teacher-subject-band">
                  <div className="home-teacher-subject-box">
                    <strong>{instructor.subject}</strong>
                    <span>{instructor.level}</span>
                  </div>
                </div>
                <div className="home-teacher-slide-content">
                  <p>{instructor.introduction}</p>
                  <Button
                    type="link"
                    className="home-teacher-details-button"
                    onClick={() => setSelectedInstructor(instructor)}
                    aria-label={`ดูประวัติและหัวข้อที่ติวของ${instructor.name}`}
                  >
                    ดูประวัติและหัวข้อที่ติว <ArrowRightOutlined aria-hidden="true" />
                  </Button>
                </div>
              </article>
            );
          })}
        </Carousel>

        <Button
          className="home-teacher-carousel-control home-teacher-carousel-control-prev"
          aria-label="ดูผู้สอนก่อนหน้า"
          icon={<ArrowLeftOutlined aria-hidden="true" />}
          onClick={() => carouselRef.current?.prev()}
        />
        <Button
          className="home-teacher-carousel-control home-teacher-carousel-control-next"
          aria-label="ดูผู้สอนถัดไป"
          icon={<ArrowRightOutlined aria-hidden="true" />}
          onClick={() => carouselRef.current?.next()}
        />
      </div>

      <p className="home-teacher-disclosure">ภาพและข้อมูลผู้สอนในส่วนนี้เป็นตัวอย่างจำลอง</p>

      <Modal
        className="home-teacher-modal"
        title={selectedInstructor ? `รู้จัก${selectedInstructor.name}` : 'รู้จักผู้สอน'}
        open={Boolean(selectedInstructor)}
        onCancel={() => setSelectedInstructor(null)}
        footer={null}
        width={560}
        destroyOnHidden
      >
        {selectedInstructor && (
          <div className="home-teacher-modal-content">
            <Tag color="blue">ข้อมูลตัวอย่างจำลอง</Tag>
            <p className="home-teacher-modal-name">
              {selectedInstructor.name} <span>{selectedInstructor.mockName}</span>
            </p>
            <h3>{selectedInstructor.subject}</h3>
            <p className="home-teacher-modal-level">{selectedInstructor.level}</p>
            <p>{selectedInstructor.bio}</p>
            <h4>หัวข้อที่ชวนติว</h4>
            <ul>
              {selectedInstructor.topics.map((topic) => <li key={topic}>{topic}</li>)}
            </ul>
            <Link className="home-teacher-modal-course-link" to="/courses" onClick={() => setSelectedInstructor(null)}>
              สำรวจคอร์สตัวอย่างทั้งหมด <ArrowRightOutlined aria-hidden="true" />
            </Link>
          </div>
        )}
      </Modal>
    </section>
  );
}

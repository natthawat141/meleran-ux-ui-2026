import writingCover from './assets/generated/course-writing-v2.png';
import dataCover from './assets/generated/course-data-v2.png';
import focusCover from './assets/generated/course-focus-v2.png';
import writingArticleCover from './assets/generated/article-writing-v2.png';
import dataArticleCover from './assets/generated/article-data-v2.png';
import { fixtureAssignments, fixtureAttempts, fixtureComparisonSets, fixtureEnrollments, fixtureQuizzes, fixtureUsers } from './mocks/typed-fixtures';
import { createInboxDemo } from './mocks/inbox';
import type {
  Assignment,
  BlogPost,
  Certificate,
  ComparisonSet,
  Course,
  CourseItem,
  Enrollment,
  InboxConversation,
  InboxMessage,
  InstructorInvite,
  InstructorRequest,
  LmsData,
  Order,
  Quiz,
  QuizAttempt,
  Role,
  User,
} from './types';

export interface BlogCoverOption {
  value: string;
  label: string;
  src: string;
}

export const blogCovers: BlogCoverOption[] = [
  { value: 'writing', label: 'การเขียนและการสื่อสาร', src: writingArticleCover },
  { value: 'data', label: 'ข้อมูลและการคิด', src: dataArticleCover },
  { value: 'focus', label: 'การเรียนรู้และการทำงาน', src: focusCover },
];

export const blogCoverFor = (key?: string): string =>
  blogCovers.find((cover) => cover.value === key)?.src ?? writingArticleCover;

// Only update untouched sample covers when loading older browser demo data.
export const seedCourseCoverReplacements: Record<
  string,
  { from: string; previousGenerated: string; to: string }
> = {
  'course-writing': {
    from: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=85',
    previousGenerated: 'course-writing-v1',
    to: writingCover,
  },
  'course-data': {
    from: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85',
    previousGenerated: 'course-data-v1',
    to: dataCover,
  },
  'course-focus': {
    from: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85',
    previousGenerated: 'course-focus-v1',
    to: focusCover,
  },
};

const instructorA: User = {
  id: 'u-nalin',
  name: 'นลิน วัฒนา',
  email: 'teacher@learn.demo',
  password: 'Teach123!',
  role: 'instructor',
  bio: 'นักออกแบบการเรียนรู้ที่เชื่อว่าทักษะใหม่เริ่มจากการลงมือทำทีละขั้น',
  status: 'active',
  baseSharePercent: 65,
  referralSharePercent: 80,
};

const instructorB: User = {
  id: 'u-than',
  name: 'ธนา พูลผล',
  email: 'than@learn.demo',
  password: 'Teach123!',
  role: 'instructor',
  bio: 'ทำงานด้านข้อมูลและการสื่อสารด้วยภาพมากกว่า 10 ปี',
  status: 'active',
  baseSharePercent: 70,
  referralSharePercent: 85,
};

const learner: User = {
  id: 'u-natee',
  name: 'นที ใจดี',
  email: 'learner@learn.demo',
  password: 'Learn123!',
  role: 'learner',
  bio: '',
  status: 'active',
};

const admin: User = {
  id: 'u-admin',
  name: 'กานต์ ดูแลระบบ',
  email: 'admin@learn.demo',
  password: 'Admin123!',
  role: 'admin',
  bio: '',
  status: 'active',
};

const videoUrl = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

export const initialData: LmsData = {
  users: [learner, instructorA, instructorB, admin, ...fixtureUsers],
  currentUserId: null,
  blogPosts: [
    {
      id: 'post-better-writing',
      title: 'เริ่มเขียนให้ชัด ด้วยคำถามสามข้อ',
      category: 'การสื่อสาร',
      coverKey: 'writing',
      excerpt: 'ก่อนลงมือเขียน ลองหยุดถามว่าเรากำลังพูดกับใคร อยากให้เขาเข้าใจอะไร และเขาจะทำอะไรต่อ',
      body: 'งานเขียนที่อ่านง่ายไม่ได้เริ่มจากการหาคำสวย ๆ แต่เริ่มจากการรู้ว่าคนอ่านต้องการอะไร\n\nลองตั้งคำถามสามข้อก่อนเขียนทุกครั้ง: ใครคือคนอ่าน เขาต้องเข้าใจเรื่องใด และเมื่ออ่านจบแล้วควรทำอะไรต่อ คำตอบเหล่านี้จะช่วยให้เราเลือกเนื้อหาที่จำเป็นและตัดส่วนที่ไม่เกี่ยวออกได้\n\nเมื่อได้คำตอบ ลองเขียนใจความหลักให้จบในหนึ่งประโยค ถ้ายังเขียนไม่ได้ อาจแปลว่าเรายังไม่ชัดว่าต้องการสื่ออะไร ใช้ประโยคนั้นเป็นเข็มทิศของบทความ แล้วค่อยขยายด้วยตัวอย่างหรือเหตุผล\n\nก่อนเผยแพร่ อ่านทวนอีกครั้งในมุมของคนที่ไม่รู้เรื่องนี้มาก่อน ตัดคำที่ไม่ช่วยให้เข้าใจ และตรวจว่าทุกย่อหน้าพาคนอ่านเข้าใกล้คำตอบที่เขามาหาหรือไม่',
      authorId: admin.id,
      status: 'published',
      readingMinutes: 4,
      createdAt: '2026-09-18T09:00:00.000Z',
      updatedAt: '2026-09-18T09:00:00.000Z',
      publishedAt: '2026-09-18T09:00:00.000Z',
    },
    {
      id: 'post-choose-a-chart',
      title: 'ก่อนเลือกกราฟ ลองเริ่มจากคำถาม',
      category: 'ข้อมูลและดิจิทัล',
      coverKey: 'data',
      excerpt: 'กราฟที่ดีไม่ใช่กราฟที่ตกแต่งเยอะที่สุด แต่คือกราฟที่ทำให้คนอ่านเห็นคำตอบได้เร็วขึ้น',
      body: 'หลายครั้งเราเปิดโปรแกรมแล้วเลือกกราฟทันที ทั้งที่ยังไม่รู้ว่าต้องการเล่าอะไร วิธีที่ง่ายกว่าคือเริ่มจากคำถามของคนอ่าน\n\nถ้าต้องการเปรียบเทียบขนาด ลองใช้แท่ง ถ้าต้องการเห็นการเปลี่ยนแปลงตามเวลา กราฟเส้นอาจตอบได้ดีกว่า ส่วนการแสดงสัดส่วนควรทำเมื่อมีหมวดหมู่ไม่มากจนอ่านยาก\n\nอย่าลืมใส่ชื่อกราฟ หน่วย ช่วงเวลา และแหล่งข้อมูลให้ครบ สิ่งเหล่านี้ช่วยให้ผู้อ่านเข้าใจว่าข้อมูลกำลังบอกอะไร และมีข้อจำกัดตรงไหน\n\nหลังทำกราฟเสร็จ ลองถามคนที่ไม่เคยเห็นข้อมูลชุดนี้ว่ามองเห็นประเด็นเดียวกับเราหรือไม่ หากต้องอธิบายนานเกินไป อาจต้องปรับวิธีนำเสนอใหม่',
      authorId: admin.id,
      status: 'published',
      readingMinutes: 5,
      createdAt: '2026-09-15T09:00:00.000Z',
      updatedAt: '2026-09-15T09:00:00.000Z',
      publishedAt: '2026-09-15T09:00:00.000Z',
    },
    {
      id: 'post-small-learning-steps',
      title: 'เรียนทีละนิด ให้ไปต่อได้จริง',
      category: 'การเรียนรู้',
      coverKey: 'focus',
      excerpt: 'เวลาเรียนรู้สิ่งใหม่ ความต่อเนื่องสำคัญกว่าการรอวันที่มีเวลาว่างมาก ๆ',
      body: 'หลายคนตั้งใจจะเรียนเมื่อมีเวลาว่างทั้งวัน แต่วันนั้นมักมาไม่ถึง ลองเริ่มจากช่วงเวลาสั้น ๆ ที่เกิดขึ้นได้จริงในชีวิตประจำวัน\n\nเลือกเป้าหมายเล็กหนึ่งอย่างสำหรับสัปดาห์นี้ เช่น ดูบทเรียนหนึ่งตอน จดสิ่งที่สงสัย หรือทดลองใช้เทคนิคหนึ่งครั้ง เป้าหมายที่ชัดทำให้เราเห็นความคืบหน้าได้ง่าย\n\nหลังเรียน ลองหยุดสักครู่แล้วสรุปด้วยคำของตัวเองว่าได้อะไร หากยังอธิบายไม่ได้ก็กลับไปทบทวนเฉพาะจุด ไม่จำเป็นต้องเริ่มใหม่ทั้งหมด\n\nการเรียนรู้ไม่จำเป็นต้องสมบูรณ์แบบในครั้งแรก ขอเพียงมีพื้นที่ให้ลองผิด ลองใหม่ และกลับมาต่อในจังหวะของตัวเอง',
      authorId: admin.id,
      status: 'published',
      readingMinutes: 4,
      createdAt: '2026-09-10T09:00:00.000Z',
      updatedAt: '2026-09-10T09:00:00.000Z',
      publishedAt: '2026-09-10T09:00:00.000Z',
    },
  ] as BlogPost[],
  courses: [
    {
      id: 'course-writing',
      slug: 'clear-writing',
      title: 'เขียนให้ชัด สื่อสารให้ตรง',
      subtitle: 'เปลี่ยนไอเดียที่ซับซ้อนให้เป็นข้อความที่คนอ่านเข้าใจ',
      description: 'ฝึกคิด จัดโครง และเขียนงานให้ชัดเจนผ่านแบบฝึกที่หยิบไปใช้กับงานจริงได้',
      category: 'การสื่อสาร',
      level: 'เริ่มต้น',
      price: 0,
      instructorId: instructorA.id,
      status: 'published',
      cover: writingCover,
      outcomes: ['จัดโครงเรื่องก่อนเริ่มเขียน', 'ตัดคำฟุ่มเฟือยโดยไม่เสียความหมาย', 'เขียนย่อหน้าให้อ่านง่าย'],
      chapters: [
        {
          id: 'ch-write-1',
          title: 'เริ่มจากสิ่งที่อยากบอก',
          description: 'ตั้งเป้าหมายให้ข้อความก่อนลงมือ',
          items: [
            { id: 'it-write-pre', type: 'quiz', title: 'แบบทดสอบวัดระดับก่อนเรียน: พื้นฐานการเขียน', quizId: 'quiz-writing-pre' },
            { id: 'it-write-v1', type: 'video', title: 'เริ่มเขียนจากผู้อ่าน', duration: '08:20', videoUrl },
            {
              id: 'it-write-a1',
              type: 'article',
              title: 'เช็กลิสต์ก่อนส่งงานเขียน',
              readingMinutes: 5,
              articleBody:
                'ข้อความที่ดีเริ่มจากการรู้ว่ากำลังพูดกับใคร\n\nก่อนเขียน ลองตอบคำถามสามข้อ: ผู้อ่านต้องรู้อะไร เขาต้องทำอะไรต่อ และมีข้อมูลอะไรที่ยังขาด\n\nเมื่อมีคำตอบแล้ว ให้เขียนประโยคใจความหนึ่งประโยค แล้วใช้ประโยคนั้นเป็นเข็มทิศของทั้งชิ้นงาน\n\nสุดท้ายอ่านทวนโดยตัดคำที่ไม่ได้ช่วยให้ผู้อ่านเข้าใจหรือตัดสินใจได้ดีขึ้น',
            },
          ],
        },
        {
          id: 'ch-write-2',
          title: 'ฝึกเขียนและทบทวน',
          description: 'ลองใช้หลักการกับสถานการณ์จริง',
          items: [
            { id: 'it-write-q1', type: 'quiz', title: 'แบบทดสอบ: เขียนให้เข้าใจ', quizId: 'quiz-writing' },
            { id: 'it-write-post', type: 'quiz', title: 'แบบทดสอบประเมินผลหลังเรียน: การเขียนเชิงประยุกต์', quizId: 'quiz-writing-post' },
          ],
        },
      ],
    },
    {
      id: 'course-data',
      slug: 'data-story',
      title: 'เล่าเรื่องด้วยข้อมูล',
      subtitle: 'อ่านตัวเลขให้เป็น แล้วสื่อสารสิ่งที่ค้นพบ',
      description: 'เรียนรู้การตั้งคำถามกับข้อมูล เลือกกราฟให้เหมาะ และนำเสนอข้อค้นพบโดยไม่บิดเบือน',
      category: 'ข้อมูลและดิจิทัล',
      level: 'กลาง',
      price: 890,
      instructorId: instructorB.id,
      status: 'published',
      cover: dataCover,
      outcomes: ['ตั้งคำถามจากชุดข้อมูล', 'เลือกภาพข้อมูลให้เหมาะกับสาร', 'นำเสนอข้อค้นพบอย่างมีบริบท'],
      chapters: [
        {
          id: 'ch-data-1',
          title: 'อ่านข้อมูลอย่างมีคำถาม',
          description: 'เริ่มจากโจทย์ ไม่ใช่กราฟ',
          items: [
            { id: 'it-data-v1', type: 'video', title: 'ข้อมูลบอกอะไรและไม่บอกอะไร', duration: '12:40', videoUrl },
            {
              id: 'it-data-a1',
              type: 'article',
              title: 'ก่อนเลือกกราฟ ลองถามสิ่งนี้',
              readingMinutes: 7,
              articleBody:
                'กราฟไม่ใช่ของตกแต่งรายงาน แต่เป็นเครื่องมือช่วยให้ผู้อ่านเห็นความสัมพันธ์\n\nเริ่มจากคำถามว่าต้องการเปรียบเทียบสัดส่วน ดูการเปลี่ยนแปลงตามเวลา หรือหาความสัมพันธ์ระหว่างตัวแปร\n\nเลือกภาพที่ทำให้ข้อสังเกตนั้นมองเห็นได้ง่ายที่สุด แล้วใส่บริบท แหล่งที่มา และข้อจำกัดไว้ใกล้กับข้อมูล',
            },
          ],
        },
        {
          id: 'ch-data-2',
          title: 'สื่อสารข้อค้นพบ',
          description: 'เล่าให้คนอื่นเข้าใจและตัดสินใจได้',
          items: [
            { id: 'it-data-q1', type: 'quiz', title: 'ทบทวน: เลือกวิธีเล่า', quizId: 'quiz-data' },
          ],
        },
      ],
    },
    {
      id: 'course-focus',
      slug: 'focused-work',
      title: 'จัดระบบงานให้เดินหน้า',
      subtitle: 'วางแผนงานรายสัปดาห์โดยไม่เพิ่มความวุ่นวาย',
      description: 'ทดลองเครื่องมือคิดและระบบทบทวนงานที่ออกแบบให้ยืดหยุ่นกับชีวิตจริง',
      category: 'การทำงาน',
      level: 'เริ่มต้น',
      price: 490,
      instructorId: instructorA.id,
      status: 'published',
      cover: focusCover,
      outcomes: ['แยกงานสำคัญออกจากงานด่วน', 'วางแผนหนึ่งสัปดาห์', 'ทบทวนและปรับระบบให้เหมาะกับตัวเอง'],
      chapters: [
        {
          id: 'ch-focus-1',
          title: 'ออกแบบสัปดาห์ของคุณ',
          description: 'เริ่มจากภาพรวมและเวลาที่มี',
          items: [
            { id: 'it-focus-v1', type: 'video', title: 'วางแผนงานโดยเริ่มจากเวลาจริง', duration: '09:15', videoUrl },
            { id: 'it-focus-q1', type: 'quiz', title: 'ทบทวนแผนงาน', quizId: 'quiz-focus' },
          ],
        },
      ],
    },
  ],
  quizzes: [
    {
      id: 'quiz-writing',
      courseId: 'course-writing',
      title: 'แบบทดสอบ: เขียนให้เข้าใจ',
      passPercent: 60,
      questions: [
        { id: 'qw-1', type: 'choice', prompt: 'ก่อนเริ่มเขียน ควรเริ่มจากอะไร', options: ['เลือกฟอนต์', 'ทำความเข้าใจผู้อ่านและสิ่งที่ต้องการสื่อ', 'เขียนให้ยาวที่สุด'], answer: 1, points: 1 },
        { id: 'qw-2', type: 'essay', prompt: 'ยกตัวอย่างประโยคหนึ่งประโยคที่คุณจะปรับให้อ่านชัดขึ้น พร้อมอธิบายเหตุผล', points: 4 },
      ],
    },
    {
      id: 'quiz-data',
      courseId: 'course-data',
      title: 'ทบทวน: เลือกวิธีเล่า',
      passPercent: 60,
      questions: [
        { id: 'qd-1', type: 'choice', prompt: 'ถ้าต้องการดูแนวโน้มที่เปลี่ยนตามเวลา ควรเริ่มจากกราฟแบบใด', options: ['กราฟเส้น', 'แผนภูมิวงกลม', 'ตารางสีตกแต่ง'], answer: 0, points: 1 },
        { id: 'qd-2', type: 'essay', prompt: 'เขียนข้อค้นพบจากข้อมูลหนึ่งอย่างที่คุณใช้ตัดสินใจได้ และระบุข้อจำกัดที่ควรบอกผู้อ่าน', points: 4 },
      ],
    },
    {
      id: 'quiz-focus',
      courseId: 'course-focus',
      title: 'ทบทวนแผนงาน',
      passPercent: 60,
      questions: [
        { id: 'qf-1', type: 'choice', prompt: 'การวางแผนสัปดาห์ที่ยืดหยุ่นควรทำอย่างไร', options: ['ใส่ทุกนาทีให้เต็ม', 'เผื่อพื้นที่สำหรับงานที่เปลี่ยนแปลง', 'ไม่ต้องทบทวนแผน'], answer: 1, points: 1 },
      ],
    },
    ...fixtureQuizzes,
  ],
  enrollments: [
    { id: 'enroll-writing', courseId: 'course-writing', userId: learner.id, createdAt: '2026-09-10' },
    { id: 'enroll-focus-direct', courseId: 'course-focus', userId: learner.id, createdAt: '2026-09-28T09:00:00.000Z' },
    { id: 'enroll-focus-referral', courseId: 'course-focus', userId: 'demo-learner-2', referralCode: 'NALIN-FOCUS', referralLinkId: 'ref-seed-nalin-focus', referralInstructorId: instructorA.id, createdAt: '2026-09-29T10:00:00.000Z' },
    { id: 'enroll-data-direct', courseId: 'course-data', userId: learner.id, createdAt: '2026-09-27T10:00:00.000Z' },
    { id: 'enroll-data-referral', courseId: 'course-data', userId: 'demo-learner-3', referralCode: 'THANA-DATA', referralLinkId: 'ref-seed-thana-data', referralInstructorId: instructorB.id, createdAt: '2026-09-30T10:00:00.000Z' },
    ...fixtureEnrollments,
  ],
  progress: {},
  attempts: [...fixtureAttempts],
  assignments: [...fixtureAssignments],
  comparisonSets: [...fixtureComparisonSets],
  orders: [
    { id: 'order-demo-focus-direct', courseId: 'course-focus', userId: learner.id, amount: 490, status: 'paid', method: 'บัตรจำลอง', createdAt: '2026-09-28T09:00:00.000Z', instructorId: instructorA.id, instructorSharePercent: 65, instructorShareAmount: 318.5, platformShareAmount: 171.5, payoutStatus: 'pending', demoFinance: true },
    { id: 'order-demo-focus-referral', courseId: 'course-focus', userId: 'demo-learner-2', amount: 490, status: 'paid', method: 'บัตรจำลอง', createdAt: '2026-09-29T10:00:00.000Z', instructorId: instructorA.id, instructorSharePercent: 80, instructorShareAmount: 392, platformShareAmount: 98, referralCode: 'NALIN-FOCUS', referralLinkId: 'ref-seed-nalin-focus', payoutStatus: 'pending', demoFinance: true },
    { id: 'order-demo-data-direct', courseId: 'course-data', userId: learner.id, amount: 890, status: 'paid', method: 'บัตรจำลอง', createdAt: '2026-09-27T10:00:00.000Z', instructorId: instructorB.id, instructorSharePercent: 70, instructorShareAmount: 623, platformShareAmount: 267, payoutStatus: 'pending', demoFinance: true },
    { id: 'order-demo-data-referral', courseId: 'course-data', userId: 'demo-learner-3', amount: 890, status: 'paid', method: 'บัตรจำลอง', createdAt: '2026-09-30T10:00:00.000Z', instructorId: instructorB.id, instructorSharePercent: 85, instructorShareAmount: 756.5, platformShareAmount: 133.5, referralCode: 'THANA-DATA', referralLinkId: 'ref-seed-thana-data', payoutStatus: 'pending', demoFinance: true },
  ],
  certificates: [] as Certificate[],
  instructorRequests: [
    {
      id: 'req-demo',
      userName: 'ศศิ ธรรมดี',
      email: 'sasi@example.test',
      intro: 'อยากแบ่งปันความรู้ด้านการทำงาน',
      status: 'pending',
      createdAt: '2026-09-18',
    },
  ] as InstructorRequest[],
  invitations: [] as InstructorInvite[],
  inboxConversations: [] as InboxConversation[],
  inboxMessages: [] as InboxMessage[],
  cartItems: [],
  mockPriceEmails: [],
  accessCodes: [],
  referralLinks: [
    { id: 'ref-seed-nalin-focus', code: 'NALIN-FOCUS', instructorId: instructorA.id, courseId: 'course-focus', createdAt: '2026-09-20T09:00:00.000Z' },
    { id: 'ref-seed-thana-data', code: 'THANA-DATA', instructorId: instructorB.id, courseId: 'course-data', createdAt: '2026-09-20T09:00:00.000Z' },
  ],
  instructorPayouts: [],
  financeDemoSeedVersion: 'instructor-earnings-v1',
};

Object.assign(initialData, createInboxDemo(initialData));

export interface DemoAccount {
  label: string;
  email: string;
  password: string;
  role: Role;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { label: 'ผู้เรียน', email: 'learner@learn.demo', password: 'Learn123!', role: 'learner' },
  { label: 'ผู้สอน', email: 'teacher@learn.demo', password: 'Teach123!', role: 'instructor' },
  { label: 'แอดมิน', email: 'admin@learn.demo', password: 'Admin123!', role: 'admin' },
];

export const createId = (prefix = 'id'): string =>
  `${prefix}-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;

export const flattenItems = (course?: Course | null): CourseItem[] =>
  course?.chapters?.flatMap((chapter) => chapter.items ?? []) ?? [];

export const formatPrice = (price: number | string): string =>
  Number(price) === 0 ? 'เรียนฟรี' : `฿${Number(price).toLocaleString('th-TH')}`;

export const instructorFor = (data: LmsData, course?: Course | null): User | undefined =>
  data.users.find((user) => user.id === course?.instructorId);

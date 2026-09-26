import ray from '../assets/chat/teacher-ray.png';
import pie from '../assets/chat/teacher-pie.png';
import nova from '../assets/chat/teacher-nova.png';
import time from '../assets/chat/teacher-time.png';
import bit from '../assets/chat/teacher-bit.png';

const bi = (th, en) => ({ th, en });

export const ACCESS_DAYS = 90;
export const SAMPLE_PRICE_USDC = 2;

export const teachers = [
  {
    id: 'ray',
    portrait: ray,
    accent: '#0074e8',
    name: bi('ครูเรย์', 'Teacher Ray'),
    subject: bi('ภาษาอังกฤษ', 'English'),
    character: bi('เป็นกันเอง ชวนคุย ไม่กลัวพูดผิด', 'Friendly, and fine with mistakes'),
    style: [
      bi('ชวนพูดก่อนอธิบายไวยากรณ์', 'Gets you speaking before explaining grammar'),
      bi('แก้ประโยคให้ดูเป็นตัวอย่าง ไม่ตำหนิ', 'Offers a better sentence without scolding'),
      bi('ถามต่อหนึ่งคำถาม เพื่อให้ได้พูดอีกประโยค', 'Asks one follow-up so you say another sentence'),
    ],
    onImage: bi(
      'เห็นรูปแล้ว เล่าเป็นประโยคสั้น ๆ ได้ไหมว่าอยากให้ช่วยตรงไหน',
      'I can see the picture. Can you tell me in one short sentence what you want help with?',
    ),
    afterPass: bi(
      'บทนี้ผ่านแล้ว ถ้าอยากพูดเพิ่ม ลองส่งประโยคใหม่อีกหนึ่งประโยคได้เลย',
      'You already passed this lesson. Send another sentence if you want more practice.',
    ),
  },
  {
    id: 'pie',
    portrait: pie,
    accent: '#0f7a6c',
    name: bi('ครูพาย', 'Teacher Pie'),
    subject: bi('คณิตศาสตร์', 'Mathematics'),
    character: bi('ใจเย็น พาแก้โจทย์ทีละขั้น', 'Calm, and works a problem one step at a time'),
    style: [
      bi('ถามก่อนว่าเคยเจอเรื่องนี้แค่ไหน', 'Asks what you already know before starting'),
      bi('ให้คำใบ้ทีละขั้นเมื่อติด', 'Gives one hint at a time when you get stuck'),
      bi('ตรวจทั้งวิธีคิดและคำตอบ และบอกตรง ๆ เมื่อไม่แน่ใจ', 'Checks the method and the answer, and says so when unsure'),
    ],
    onImage: bi(
      'ได้รับรูปแล้ว โจทย์อยู่ตรงไหน ลองพิมพ์สิ่งที่โจทย์ถามมาได้เลย',
      'Got the picture. Type what the problem is asking for.',
    ),
    afterPass: bi(
      'บทนี้ผ่านแล้ว ถ้ามีโจทย์คล้ายกัน ส่งมาได้ ฉันจะชวนแยกขั้นอีกครั้ง',
      'You passed. If you have a similar problem, send it and we will split it into steps again.',
    ),
  },
  {
    id: 'nova',
    portrait: nova,
    accent: '#1287b8',
    name: bi('ครูโนวา', 'Teacher Nova'),
    subject: bi('วิทยาศาสตร์', 'Science'),
    character: bi('ช่างสงสัย เชื่อมความรู้กับชีวิตจริง', 'Curious, and ties ideas to everyday life'),
    style: [
      bi('เริ่มจากสิ่งที่สังเกตได้รอบตัว', 'Starts from something you can notice nearby'),
      bi('ถามคำถามสั้น แล้วค่อยเติมคำอธิบาย', 'Asks a short question, then adds the explanation'),
      bi('ไม่เร่งให้จำคำศัพท์ก่อนเข้าใจปรากฏการณ์', 'Does not rush vocabulary before the idea makes sense'),
    ],
    onImage: bi(
      'รูปน่าสนใจ ลองบอกสิ่งที่เห็นอย่างน้อยหนึ่งอย่าง',
      'Interesting picture. Name one thing you notice in it.',
    ),
    afterPass: bi(
      'บทนี้จบแล้ว ถ้าอยากรู้ต่อ ถามสิ่งที่ยังสงสัยได้เลย',
      'This lesson is done. Ask about anything that still feels curious.',
    ),
  },
  {
    id: 'time',
    portrait: time,
    accent: '#8a6232',
    name: bi('ครูไทม์', 'Teacher Time'),
    subject: bi('ประวัติศาสตร์', 'History'),
    character: bi('เล่าเรื่องสนุก ชวนมองหลายมุม', 'Tells the story, then asks for more than one view'),
    style: [
      bi('เล่าเหตุการณ์สั้น ๆ ก่อนตั้งคำถาม', 'Tells a short scene before asking a question'),
      bi('ชวนเทียบอย่างน้อยสองมุมมอง', 'Asks you to compare at least two perspectives'),
      bi('ไม่สรุปว่ามีคำตอบเดียวเสมอไป', 'Does not pretend there is always one answer'),
    ],
    onImage: bi(
      'เห็นรูปแล้ว ภาพนี้ทำให้นึกถึงเรื่องอะไร เล่าสั้น ๆ ได้เลย',
      'I see the picture. What story does it remind you of?',
    ),
    afterPass: bi(
      'บทนี้ผ่านแล้ว ถ้าอยากมองอีกมุม ส่งความเห็นมาได้',
      'You finished. Send another point of view if you want to keep going.',
    ),
  },
  {
    id: 'bit',
    portrait: bit,
    accent: '#2450c4',
    name: bi('ครูบิต', 'Teacher Bit'),
    subject: bi('คอมพิวเตอร์และ AI', 'Computing and AI'),
    character: bi('ชวนลงมือทำและทดลอง', 'Hands-on, and happy to experiment'),
    style: [
      bi('ให้ลองทำของเล็ก ๆ ก่อนอธิบายทฤษฎี', 'Has you try a small thing before the theory'),
      bi('พรอมต์ที่ดีต้องบอกเป้าหมาย', 'A useful prompt says what you want'),
      bi('ผลที่ยังไม่ดีคือข้อมูลสำหรับลองรอบถัดไป', 'A weak result is information for the next try'),
    ],
    onImage: bi(
      'ได้รูปแล้ว อยากให้ช่วยทำอะไรกับมัน พิมพ์เป้าหมายมาหนึ่งประโยค',
      'Picture received. Type one sentence about what you want done with it.',
    ),
    afterPass: bi(
      'บทนี้ผ่านแล้ว ส่งพรอมต์เวอร์ชันใหม่มาได้ ถ้าอยากลองปรับ',
      'You passed. Send a revised prompt if you want another try.',
    ),
  },
];

export const lessons = [
  {
    id: 'ray-intro',
    teacherId: 'ray',
    free: true,
    title: bi('แนะนำตัวเป็นภาษาอังกฤษ', 'Introduce yourself in English'),
    level: bi('เริ่มต้น', 'Starter'),
    goal: bi('พูดได้อย่างน้อยสองประโยคเกี่ยวกับตัวเอง', 'Say at least two sentences about yourself'),
    pass: bi('ส่งชื่อและอีกหนึ่งประโยคเป็นภาษาอังกฤษ', 'Send your name and one more sentence in English'),
    steps: [
      {
        id: 'ray-level',
        example: 'I feel okay, but I forget words',
        prompt: bi(
          'Hi! ฉันครูเรย์ วันนี้ไม่ต้องกลัวพูดผิด เล่าหน่อยว่าตอนนี้ภาษาอังกฤษของคุณเป็นยังไง',
          'Hi, I am Ray. Mistakes are fine here. How does English feel for you right now?',
        ),
        hints: [
          bi('ตอบสั้น ๆ ก็ได้ เช่น ยังไม่ค่อยกล้าพูด', 'A short answer is enough, such as “I do not feel confident yet.”'),
        ],
        explain: bi(
          'ขั้นนี้ฉันแค่อยากรู้จุดเริ่ม ไม่มีการให้คะแนน ตอบเป็นไทยหรืออังกฤษก็ได้',
          'This step is only about your starting point. Thai or English is fine, and nothing is graded.',
        ),
        success: bi('ขอบคุณที่บอก งั้นเราค่อย ๆ พูดทีละประโยค', 'Thanks for telling me. We will speak one sentence at a time.'),
      },
      {
        id: 'ray-name',
        example: 'My name is Maya',
        prompt: bi(
          'ลองแนะนำตัวเป็นภาษาอังกฤษ โดยขึ้นต้นว่า My name is แล้วตามด้วยชื่อของคุณ',
          'Introduce yourself in English. Start with “My name is” and then your name.',
        ),
        hints: [
          bi('โครงประโยคคือ My name is + ชื่อ', 'The pattern is “My name is” plus your name.'),
          bi('ตัวอย่าง: My name is Maya', 'Example: My name is Maya.'),
        ],
        explain: bi(
          'ประโยคนี้ใช้บอกชื่อโดยตรง I am ตามด้วยชื่อก็ใช้ได้เหมือนกัน',
          'This sentence states your name. “I am” plus your name works too.',
        ),
        success: bi('ชัดดี ฉันจับชื่อได้แล้ว', 'Clear. I caught your name.'),
      },
      {
        id: 'ray-like',
        example: 'I like reading at night',
        prompt: bi(
          'ต่อไปอีกประโยค เล่าสิ่งที่ชอบ โดยขึ้นต้นว่า I like',
          'One more sentence. Say something you like, starting with “I like”.',
        ),
        hints: [
          bi('เติมคำนามหรือกริยาเติม -ing หลัง I like', 'After “I like”, add a noun or a verb with -ing.'),
          bi('ตัวอย่าง: I like cooking on Sundays', 'Example: I like cooking on Sundays.'),
        ],
        explain: bi(
          'I like ใช้บอกสิ่งที่ชอบเป็นประจำ ไม่ต้องแต่งประโยคยาว',
          '“I like” is for something you enjoy. A short sentence is enough.',
        ),
        success: bi('ฟังแล้วรู้เลยว่าคุณชอบอะไร', 'I can hear what you enjoy.'),
      },
    ],
    closing: bi(
      'ผ่านบทนี้แล้ว คุณพูดเกี่ยวกับตัวเองได้สองประโยค คราวหน้าเราไปเล่าเรื่องเมื่อวานกัน',
      'You passed. You said two sentences about yourself. Next time we can talk about yesterday.',
    ),
  },
  {
    id: 'ray-yesterday',
    teacherId: 'ray',
    free: false,
    title: bi('เล่าเมื่อวานเป็นภาษาอังกฤษ', 'Talk about yesterday'),
    level: bi('เริ่มต่อจากบทฟรี', 'After the free lesson'),
    goal: bi('ใช้ประโยคอดีตอย่างน้อยสองประโยค', 'Use at least two past-tense sentences'),
    pass: bi('ส่งสองประโยคที่มีคำบอกอดีต เช่น yesterday, went, watched', 'Send two sentences with a past marker such as yesterday, went, or watched'),
    steps: [
      {
        id: 'ray-past-1',
        example: 'Yesterday I watched a film',
        prompt: bi(
          'มาเล่าเมื่อวานกัน ลองหนึ่งประโยคที่มี yesterday หรือคำกริยาอดีต เช่น went, watched, studied',
          'Let us talk about yesterday. Send one sentence with “yesterday” or a past verb such as went, watched, or studied.',
        ),
        hints: [
          bi('โครงง่าย ๆ คือ Yesterday I + กริยาอดีต', 'A simple frame is “Yesterday I” plus a past verb.'),
          bi('watched, went, ate, studied ใช้ได้', 'watched, went, ate, and studied all work.'),
        ],
        explain: bi(
          'เหตุการณ์ที่จบไปแล้วใช้รูปอดีต ไม่ใช้ I watch เมื่อกำลังเล่าเมื่อวาน',
          'A finished event uses a past form. “I watch” does not fit a story about yesterday.',
        ),
        success: bi('ประโยคนี้เล่าอดีตได้แล้ว', 'That sentence sits in the past.'),
      },
      {
        id: 'ray-past-2',
        example: 'Last night I studied English',
        prompt: bi(
          'ขออีกประโยคหนึ่ง คนละเหตุการณ์ ใช้ yesterday หรือ last night ก็ได้',
          'One different event, please. You can use “yesterday” or “last night”.',
        ),
        hints: [
          bi('เปลี่ยนกิจกรรมจากประโยคแรก', 'Change the activity from your first sentence.'),
        ],
        explain: bi(
          'last night ใช้กับช่วงค่ำที่ผ่านมา ส่วน yesterday ใช้กับวันก่อนทั้งวัน',
          '“Last night” is the previous evening. “Yesterday” is the previous day.',
        ),
        success: bi('สองประโยคนี้เล่าคนละเรื่องได้ชัด', 'These two sentences tell different moments.'),
      },
    ],
    closing: bi(
      'ผ่านแล้ว คุณเล่าอดีตได้สองประโยคโดยไม่ต้องรีบแต่งให้สมบูรณ์แบบ',
      'You passed. You told two past events without needing a perfect essay.',
    ),
  },
  {
    id: 'pie-balance',
    teacherId: 'pie',
    free: true,
    title: bi('สมการขั้นเดียว', 'One-step equations'),
    level: bi('เริ่มต้น', 'Starter'),
    goal: bi('หาค่า x จากสมการบวกและสมการคูณ', 'Find x in an addition equation and a multiplication equation'),
    pass: bi('ตอบ x + 5 = 12 ได้ 7 และ 2x = 8 ได้ 4 พร้อมบอกวิธีสั้น ๆ', 'Answer 7 for x + 5 = 12, 4 for 2x = 8, and name the method'),
    steps: [
      {
        id: 'pie-level',
        example: 'เคยเห็น แต่ยังสับสนตอนย้ายข้าง',
        prompt: bi(
          'ฉันครูพาย ก่อนเริ่ม เล่าหน่อยว่าเคยเจอสมการแค่ไหน ไม่ต้องกลัวตอบว่ายังไม่เคย',
          'I am Pie. Before we start, how much have you seen equations? “Not yet” is a fine answer.',
        ),
        hints: [
          bi('ตอบระดับคร่าว ๆ ก็พอ เช่น เคยเห็นในห้องเรียน', 'A rough level is enough, such as “I saw them in class.”'),
        ],
        explain: bi(
          'ฉันถามเพื่อจะได้ไม่ข้ามขั้นที่คุณยังไม่ชิน ยังไม่มีการตรวจคำตอบ',
          'I ask so I do not skip a step you still need. This reply is not graded.',
        ),
        success: bi('รับทราบ เราจะเดินทีละการกระทำ', 'Noted. We will do one operation at a time.'),
      },
      {
        id: 'pie-add',
        example: '7',
        prompt: bi(
          'ดูสมการ x + 5 = 12 ห้าอยู่กับ x ทางซ้าย ถ้าย้ายไปอีกฝั่งต้องลบ ลองตอบค่าของ x',
          'Look at x + 5 = 12. The 5 is with x. Moving it across means subtracting. What is x?',
        ),
        hints: [
          bi('ขั้นเดียว: 12 − 5', 'One step: 12 − 5.'),
          bi('คำตอบเป็นจำนวนเต็มจำนวนเดียว', 'The answer is a single whole number.'),
        ],
        explain: bi(
          'ทำอย่างเดียวกันทั้งสองข้าง ลบ 5 จากซ้ายและขวา เหลือ x = 12 − 5',
          'Do the same thing to both sides. Subtract 5, and x = 12 − 5 remains.',
        ),
        success: bi('ใช่ x เท่ากับ 7 เพราะ 7 + 5 = 12', 'Yes. x is 7, because 7 + 5 = 12.'),
      },
      {
        id: 'pie-mul',
        example: '4',
        prompt: bi(
          'อีกข้อ 2x = 8 สองกำลังคูณ x อยู่ ลองตอบค่าของ x',
          'Next, 2x = 8. Two is multiplying x. What is x?',
        ),
        hints: [
          bi('การคูณย้อนด้วยการหาร ทั้งสองข้างหารด้วย 2', 'Undo multiplication by dividing both sides by 2.'),
        ],
        explain: bi(
          '2x หมายถึง 2 คูณ x หารทั้งสองข้างด้วย 2 จะได้ x = 8 ÷ 2',
          '2x means 2 times x. Divide both sides by 2, so x = 8 ÷ 2.',
        ),
        success: bi('ถูก x เท่ากับ 4', 'Correct. x is 4.'),
      },
      {
        id: 'pie-method',
        example: 'ข้อแรกใช้ลบ ข้อสองใช้หาร',
        prompt: bi(
          'ขอกระบวนการสั้น ๆ ข้อแรกคุณใช้การกระทำอะไร และข้อสองใช้การกระทำอะไร',
          'Name the operations in a short line. What did you do in the first problem, and what in the second?',
        ),
        hints: [
          bi('คำที่กำลังมองหาคือ ลบ กับ หาร', 'The words to look for are subtract and divide.'),
        ],
        explain: bi(
          'บวกย้อนด้วยลบ คูณย้อนด้วยหาร ฉันตรวจวิธีคิดตรงนี้ ไม่ใช่แค่ตัวเลข',
          'Addition undoes with subtraction. Multiplication undoes with division. I am checking the method here.',
        ),
        success: bi('วิธีคิดครบ ทั้งสองการกระทำ', 'The method is complete. Both operations are there.'),
      },
    ],
    closing: bi(
      'ผ่านบทฟรีนี้แล้ว คุณทั้งตอบถูกและบอกได้ว่าใช้ลบกับหาร โจทย์คำจะอยู่ในบทถัดไป',
      'You passed the free lesson. The answer and the method were both there. Word problems come next.',
    ),
  },
  {
    id: 'pie-change',
    teacherId: 'pie',
    free: false,
    title: bi('โจทย์เงินทอน', 'A change word problem'),
    level: bi('ต่อจากสมการขั้นเดียว', 'After one-step equations'),
    goal: bi('แยกโจทย์เงินทอนเป็นราคารวม แล้วค่อยหาเงินทอน', 'Split a change problem into total price, then change'),
    pass: bi('ตอบเงินทอนได้ 40 บาท', 'Answer that the change is 40 baht'),
    steps: [
      {
        id: 'pie-ask',
        example: 'ต้องหาเงินทอน',
        prompt: bi(
          'โจทย์: สมุดราคาเล่มละ 20 บาท ซื้อ 3 เล่ม จ่ายด้วยแบงก์ 100 บาท ก่อนคิดเลข โจทย์อยากให้หาอะไร',
          'Problem: notebooks are 20 baht each. You buy 3 and pay with a 100-baht note. Before the arithmetic, what is the question asking for?',
        ),
        hints: [
          bi('ยังไม่ต้องหาตัวเลข บอกสิ่งที่โจทย์ถาม', 'Do not calculate yet. Name what is being asked.'),
        ],
        explain: bi(
          'โจทย์เงินทอนมีสองช่วง หาราคารวมก่อน แล้วเอาเงินที่จ่ายไปลบ',
          'Change problems have two parts: total price first, then subtract it from the money paid.',
        ),
        success: bi('ใช่ เป้าหมายคือเงินทอน ไม่ใช่แค่ราคารวม', 'Yes. The goal is the change, not only the total price.'),
      },
      {
        id: 'pie-forty',
        example: '40',
        prompt: bi(
          'คิดสองขั้นได้เลย ราคารวมคือ 20 คูณ 3 แล้วเอา 100 ลบด้วยราคารวม ได้เงินทอนเท่าไร',
          'Take both steps. The total is 20 times 3. Then subtract that total from 100. How much change is left?',
        ),
        hints: [
          bi('20 × 3 = 60', '20 × 3 = 60'),
          bi('จากนั้น 100 − 60', 'Then 100 − 60.'),
        ],
        explain: bi(
          'ถ้าหยุดที่ 60 จะได้ราคารวม เงินทอนคือเงินที่จ่ายเกินราคานั้น',
          'Stopping at 60 gives the price. Change is the amount paid beyond that price.',
        ),
        success: bi('40 บาท ตรวจแล้วยอดนี้สอดคล้องกับ 100 − 60', '40 baht. That matches 100 − 60.'),
      },
    ],
    closing: bi(
      'ผ่านแล้ว คุณไม่ได้หยุดที่ราคารวม และไปจนถึงเงินทอน',
      'You passed. You did not stop at the total price. You reached the change.',
    ),
  },
  {
    id: 'nova-water',
    teacherId: 'nova',
    free: true,
    title: bi('น้ำเปลี่ยนสถานะ', 'Water changes state'),
    level: bi('เริ่มต้น', 'Starter'),
    goal: bi('เชื่อมน้ำแข็ง น้ำ และไอน้ำกับสิ่งที่เจอในบ้าน', 'Connect ice, water, and steam to something at home'),
    pass: bi('บอกได้ว่าน้ำเดือดกลายเป็นไอ', 'Say that boiling water becomes steam'),
    steps: [
      {
        id: 'nova-notice',
        example: 'น้ำแข็งแข็งขึ้น และเย็น',
        prompt: bi(
          'ฉันครูโนวา ถ้าเอาแก้วน้ำไปแช่ช่องฟรีซทั้งคืน คุณคิดว่าน้ำเปลี่ยนไปยังไง',
          'I am Nova. If a glass of water stays in the freezer overnight, what do you think happens to it?',
        ),
        hints: [
          bi('นึกถึงก้อนน้ำแข็งในถาด', 'Think of ice cubes in a tray.'),
        ],
        explain: bi(
          'ความเย็นทำให้ของเหลวเรียงตัวแน่นขึ้น จนกลายเป็นของแข็งที่เรียกว่าน้ำแข็ง',
          'Cold lets the liquid settle into a solid we call ice.',
        ),
        success: bi('นั่นคือการเปลี่ยนจากของเหลวเป็นของแข็ง', 'That is the change from liquid to solid.'),
      },
      {
        id: 'nova-steam',
        example: 'กลายเป็นไอน้ำ',
        prompt: bi(
          'อีกด้านหนึ่ง ตอนน้ำในหม้อเดือด คุณเห็นอะไรลอยขึ้น เรียกสิ่งนั้นว่าอะไร',
          'On the other side, when water boils in a pot, what rises? What do you call it?',
        ),
        hints: [
          bi('คำที่ใช่คือ ไอ หรือ ไอน้ำ', 'The word is steam, or vapor.'),
        ],
        explain: bi(
          'ความร้อนทำให้น้ำกระจายเป็นแก๊ส ที่มองเห็นเหนือหม้อคือไอน้ำ',
          'Heat spreads water into a gas. What you see above the pot is steam.',
        ),
        success: bi('ใช่ น้ำเดือดกลายเป็นไอ นั่นคือสถานะแก๊ส', 'Yes. Boiling water becomes steam, the gas state.'),
      },
    ],
    closing: bi(
      'ผ่านแล้ว น้ำแข็งในฟรีซกับไอเหนือหม้อเป็นน้ำสถานะต่างกันของสิ่งเดียวกัน',
      'You passed. Ice in the freezer and steam above a pot are different states of the same water.',
    ),
  },
  {
    id: 'nova-motion',
    teacherId: 'nova',
    free: false,
    title: bi('ของที่หยุดนิ่งกับของที่ขยับ', 'Still things and moving things'),
    level: bi('ต่อจากสถานะของน้ำ', 'After states of water'),
    goal: bi('บอกแรงที่เปลี่ยนการเคลื่อนที่จากชีวิตประจำวัน', 'Name a force that changes motion in daily life'),
    pass: bi('ยกตัวอย่างแรงหนึ่งอย่างที่ทำให้ของขยับหรือหยุด', 'Give one force that makes something start or stop'),
    steps: [
      {
        id: 'nova-force',
        example: 'เบรกทำให้จักรยานหยุด',
        prompt: bi(
          'มองรอบตัว สิ่งใดสิ่งหนึ่งที่เพิ่งขยับหรือเพิ่งหยุด แรงอะไรทำให้มันเปลี่ยน',
          'Look around. Something just started or stopped moving. What force changed it?',
        ),
        hints: [
          bi('ดัน ดึง เบรก หรือแรงเสียดทาน ใช้ได้', 'A push, a pull, a brake, or friction all count.'),
        ],
        explain: bi(
          'แรงคือสิ่งที่เปลี่ยนความเร็วหรือทิศทาง ไม่จำเป็นต้องเป็นสูตร',
          'A force changes speed or direction. You do not need a formula yet.',
        ),
        success: bi('ตัวอย่างนี้เห็นแรงกับการเคลื่อนที่อยู่ในเหตุการณ์เดียวกัน', 'This example keeps the force and the motion in one event.'),
      },
    ],
    closing: bi(
      'ผ่านบทนี้ ครั้งหน้าค่อยใส่ตัวเลขเมื่อตัวอย่างในชีวิตชัดแล้ว',
      'You passed. Numbers can wait until the everyday example is clear.',
    ),
  },
  {
    id: 'time-market',
    teacherId: 'time',
    free: true,
    title: bi('ตลาดเดียวกัน สองบันทึก', 'One market, two records'),
    level: bi('เริ่มต้น', 'Starter'),
    goal: bi('เห็นว่าเหตุการณ์เดียวกันเล่าได้มากกว่าหนึ่งมุม', 'See that one event can be told from more than one side'),
    pass: bi('เปรียบเทียบมุมชาวตลาดกับมุมพ่อค้าได้อย่างน้อยหนึ่งจุด', 'Compare the market side and the merchant side on at least one point'),
    steps: [
      {
        id: 'time-listen',
        example: 'มีสองมุม',
        prompt: bi(
          'ฉันครูไทม์ ฟังเรื่องสั้นนี้ บันทึกท้องถิ่นบอกว่าตลาดวันนี้คึกคักเพราะเรือสินค้าเข้า พ่อค้าต่างถิ่นเขียนว่าตลาดเงียบเพราะของแพง คุณเห็นกี่มุมในเรื่องนี้',
          'I am Time. A local note says the market was busy because trading boats arrived. A visiting merchant wrote that it was quiet because goods were expensive. How many views are in this story?',
        ),
        hints: [
          bi('อย่างน้อยมีคนเล่าสองคน', 'At least two people are telling it.'),
        ],
        explain: bi(
          'ประวัติศาสตร์มักเหลือมากกว่าหนึ่งบันทึก บันทึกคนละฉบับไม่จำเป็นต้องโกหกทั้งคู่ อาจเห็นคนละด้าน',
          'History often leaves more than one record. Two accounts can notice different sides without one being a total lie.',
        ),
        success: bi('คุณจับได้ว่าเรื่องนี้ไม่ได้มีเสียงเดียว', 'You caught that this story is not one voice.'),
      },
      {
        id: 'time-compare',
        example: 'ชาวตลาดมองที่เรือเข้า พ่อค้ามองที่ราคา',
        prompt: bi(
          'ถ้าคุณยืนในตลาดวันนั้น มุมของคุณต่างจากพ่อค้าตรงไหน ตอบสักจุดเดียวก็พอ',
          'If you were standing in that market, how would your view differ from the merchant’s? One point is enough.',
        ),
        hints: [
          bi('เทียบสิ่งที่แต่ละคนให้ความสำคัญ เช่น ความคึกคัก หรือราคา', 'Compare what each person cared about, such as the crowd or the price.'),
        ],
        explain: bi(
          'การเทียบมุมไม่ต้องตัดสินว่าใครถูกทั้งเรื่อง แค่บอกว่าแต่ละคนมองอะไร',
          'Comparing views does not require a winner. Say what each person was looking at.',
        ),
        success: bi('จุดนี้ทำให้สองบันทึกอยู่ข้างกันได้', 'That point lets the two records sit side by side.'),
      },
    ],
    closing: bi(
      'ผ่านแล้ว เรื่องเดียวกันเล่าต่างกันได้ เพราะคนละคนเห็นคนละอย่าง',
      'You passed. The same event can be told differently because people notice different things.',
    ),
  },
  {
    id: 'time-source',
    teacherId: 'time',
    free: false,
    title: bi('ใครเป็นคนเขียนบันทึก', 'Who wrote the record'),
    level: bi('ต่อจากสองมุมมอง', 'After two perspectives'),
    goal: bi('ถามที่มาของหลักฐานก่อนเชื่อสรุป', 'Ask where a source comes from before trusting a conclusion'),
    pass: bi('ตั้งคำถามอย่างน้อยหนึ่งข้อเกี่ยวกับผู้เขียนบันทึก', 'Ask at least one question about the person who wrote the record'),
    steps: [
      {
        id: 'time-who',
        example: 'คนเขียนอยู่ฝ่ายไหน และเขียนตอนไหน',
        prompt: bi(
          'ก่อนเชื่อประโยคที่ว่า “ตลาดซบเซาทั้งปี” คุณจะถามอะไรเกี่ยวกับคนที่เขียนประโยคนี้',
          'Before trusting “the market slumped all year,” what would you ask about the person who wrote that sentence?',
        ),
        hints: [
          bi('ถามว่าเขาอยู่ที่นั่นไหม เขียนให้ใครอ่าน หรือเขียนห่างจากเหตุการณ์แค่ไหน', 'Ask whether they were there, who they wrote for, or how long after the event they wrote.'),
        ],
        explain: bi(
          'ผู้เขียนมีที่อยู่และเหตุผลในการเขียน คำถามเหล่านี้ยังไม่ใช่คำตอบ แต่กันไม่ให้สรุปเร็วไป',
          'A writer has a place and a reason. These questions are not the answer. They slow down a rushed conclusion.',
        ),
        success: bi('คำถามนี้เปิดทางให้ตรวจหลักฐาน แทนที่จะรับสรุปทันที', 'That question checks the source instead of taking the summary at once.'),
      },
    ],
    closing: bi(
      'ผ่านบทนี้ การเล่าเรื่องสนุกยังต้องเหลือที่ไว้ถามว่าใครเป็นคนเล่า',
      'You passed. A good story still leaves room to ask who told it.',
    ),
  },
  {
    id: 'bit-prompt',
    teacherId: 'bit',
    free: true,
    title: bi('พรอมต์ที่บอกเป้าหมาย', 'A prompt that states a goal'),
    level: bi('เริ่มต้น', 'Starter'),
    goal: bi('เขียนคำสั่งให้ AI โดยมีงานที่อยากได้ชัดหนึ่งอย่าง', 'Write an AI instruction with one clear task'),
    pass: bi('ส่งพรอมต์หนึ่งประโยคที่บอกว่างานคืออะไร', 'Send one prompt sentence that says what the task is'),
    steps: [
      {
        id: 'bit-task',
        example: 'อยากให้ช่วยสรุปบทเรียน',
        prompt: bi(
          'ฉันครูบิต พรอมต์คือคำสั่งที่บอกว่าอยากได้อะไร วันนี้คุณอยากให้คอมพิวเตอร์ช่วยงานแบบไหน',
          'I am Bit. A prompt says what you want. What kind of help do you want from a computer today?',
        ),
        hints: [
          bi('ชื่องานก็พอ เช่น สรุป อธิบาย หรือตรวจประโยค', 'The task name is enough: summarize, explain, or check a sentence.'),
        ],
        explain: bi(
          'ถ้าไม่บอกเป้าหมาย โมเดลต้องเดา และผลจะแกว่ง ขั้นนี้ยังไม่ต้องเขียนพรอมต์สมบูรณ์',
          'Without a goal, the model has to guess and the result wanders. You do not need a full prompt yet.',
        ),
        success: bi('มีเป้าหมายแล้ว ต่อไปใส่เป้าหมายนั้นลงในประโยคคำสั่ง', 'There is a goal. Next, put that goal into an instruction.'),
      },
      {
        id: 'bit-write',
        example: 'ช่วยสรุปย่อหน้านี้เป็น 3 ข้อ สำหรับนักเรียนมัธยม',
        prompt: bi(
          'เขียนพรอมต์หนึ่งประโยค ให้เห็นว่างานคืออะไร และทำให้ใครหรือรูปแบบไหน',
          'Write one prompt sentence. Show the task, and who it is for or what shape the result should take.',
        ),
        hints: [
          bi('ขึ้นต้นด้วย กริยา เช่น ช่วยสรุป ช่วยอธิบาย ช่วยเขียน', 'Start with a verb, such as summarize, explain, or draft.'),
          bi('เติมผู้รับหรือจำนวนข้อ จะชัดขึ้น', 'Add the audience or a count, and it gets clearer.'),
        ],
        explain: bi(
          'พรอมต์ที่ใช้ได้มีอย่างน้อยสองส่วน: อยากให้ทำอะไร และอยากได้ผลแบบไหน',
          'A usable prompt has at least two parts: the action, and the shape of the result.',
        ),
        success: bi('พรอมต์นี้ลงมือทำต่อได้ เพราะมีงานชัด', 'This prompt can be tried, because the task is clear.'),
      },
    ],
    closing: bi(
      'ผ่านแล้ว รอบหน้าลองส่งพรอมต์เดิมที่เติมตัวอย่างหนึ่งข้อเข้าไป',
      'You passed. Next time, try the same prompt with one example added.',
    ),
  },
  {
    id: 'bit-revise',
    teacherId: 'bit',
    free: false,
    title: bi('ปรับพรอมต์รอบสอง', 'Revise a prompt'),
    level: bi('ต่อจากพรอมต์แรก', 'After the first prompt'),
    goal: bi('เพิ่มเงื่อนไขหนึ่งอย่างเมื่อผลรอบแรกยังไม่ตรง', 'Add one constraint when the first result misses'),
    pass: bi('ส่งพรอมต์ที่ระบุทั้งงานและข้อจำกัด', 'Send a prompt that states both the task and a limit'),
    steps: [
      {
        id: 'bit-limit',
        example: 'ช่วยสรุปเป็น 3 ข้อ ไม่เกินข้อละ 12 คำ',
        prompt: bi(
          'สมมติรอบแรกยาวเกินไป เขียนพรอมต์ใหม่ที่มีงานเดิม และเพิ่มข้อจำกัดหนึ่งอย่าง เช่น ความยาวหรือจำนวนข้อ',
          'Suppose the first result was too long. Rewrite the prompt with the same task, plus one limit such as length or a count.',
        ),
        hints: [
          bi('ใส่ตัวเลขลงไป เช่น 3 ข้อ หรือไม่เกิน 50 คำ', 'Put a number in it, such as 3 bullets or under 50 words.'),
        ],
        explain: bi(
          'การปรับพรอมต์คือการทดลอง เปลี่ยนทีละเงื่อนไข จะได้รู้ว่าอะไรทำให้ผลเปลี่ยน',
          'Revision is an experiment. Change one constraint so you can see what moved the result.',
        ),
        success: bi('รอบนี้ทั้งงานและขอบเขตอยู่ในประโยคเดียวกัน', 'This version has both the task and the boundary in one sentence.'),
      },
    ],
    closing: bi(
      'ผ่านบทนี้ การทดลองรอบสองมีค่ากว่าพรอมต์ยาวที่ยังไม่เคยลอง',
      'You passed. A second experiment is worth more than a long prompt you never run.',
    ),
  },
];

export function teacherById(id) {
  return teachers.find((teacher) => teacher.id === id) ?? null;
}

export function lessonById(id) {
  return lessons.find((lesson) => lesson.id === id) ?? null;
}

export function lessonsFor(teacherId) {
  return lessons.filter((lesson) => lesson.teacherId === teacherId);
}

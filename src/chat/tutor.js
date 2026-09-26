const pastPattern = /\b(yesterday|last night|last week|ago|went|watched|studied|ate|played|did|was|were|walked|cooked|read|bought|saw|made|had|worked)\b/i;

function words(text) {
  return text.trim();
}

function englishWords(text) {
  return text.match(/[A-Za-z']+/g) ?? [];
}

function feedback(th, en) {
  return { ok: false, feedback: { th, en } };
}

function evaluate(stepId, text) {
  const value = words(text);
  if (!value) return feedback('ยังไม่มีข้อความให้ตรวจ', 'There is no message to check yet.');

  if (stepId === 'ray-level' || stepId === 'pie-level' || stepId === 'nova-notice' || stepId === 'time-listen' || stepId === 'bit-task' || stepId === 'pie-ask' || stepId === 'nova-force' || stepId === 'time-who') {
    if (stepId === 'nova-steam') return evaluate('nova-steam', value);
    if (value.length < 2) return feedback('ขออีกนิด อย่างน้อยหนึ่งคำ', 'A little more, at least one word.');
    if (stepId === 'pie-ask' && !/ทอน|เหลือ|change|หาอะไร|what/i.test(value) && value.length < 8) {
      return feedback('ใกล้แล้ว บอกสิ่งที่โจทย์อยากได้ เช่น เงินทอน', 'Close. Name what the problem wants, such as the change.');
    }
    if (stepId === 'time-who' && value.length < 8) {
      return feedback('ลองตั้งเป็นคำถามเกี่ยวกับคนเขียน เช่น เขาอยู่ที่นั่นไหม', 'Try a question about the writer, such as whether they were there.');
    }
    if (stepId === 'nova-force' && !/แรง|ดัน|ดึง|เบรก|เสียดทาน|push|pull|brake|friction|force/i.test(value)) {
      return feedback('ใส่แรงที่ทำให้มันเปลี่ยนด้วย เช่น ดัน ดึง หรือเบรก', 'Include the force that changed it, such as a push, a pull, or a brake.');
    }
    return { ok: true };
  }

  if (stepId === 'ray-name') {
    if (/my name is\s+\p{L}/iu.test(value) || /i am\s+\p{L}/iu.test(value) || /i'm\s+\p{L}/iu.test(value) || /i’m\s+\p{L}/iu.test(value)) return { ok: true };
    if (/[ก-๙]/.test(value) && englishWords(value).length < 3) {
      return feedback('ชื่อภาษาไทยใช้ได้ ทีนี้ลองทั้งประโยคว่า My name is แล้วตามด้วยชื่อ', 'Your Thai name is fine. Now try the whole sentence: My name is, then your name.');
    }
    return feedback('ใกล้แล้ว ขึ้นต้นว่า My name is หรือ I am แล้วใส่ชื่อต่อท้าย', 'Close. Start with “My name is” or “I am”, then add your name.');
  }

  if (stepId === 'ray-like') {
    if (/\bi like\b|\bi love\b|\bi enjoy\b/i.test(value) && englishWords(value).length >= 3) return { ok: true };
    return feedback('ลองขึ้นต้นว่า I like แล้วตามด้วยสิ่งที่ชอบ เช่น I like music', 'Try starting with “I like” and the thing you enjoy, such as “I like music”.');
  }

  if (stepId === 'ray-past-1' || stepId === 'ray-past-2') {
    if (pastPattern.test(value) && englishWords(value).length >= 3) return { ok: true };
    if (/\b(watch|go|study|eat|play)\b/i.test(value)) {
      return feedback('กริยานี้ยังเป็นรูปปัจจุบัน ลอง watched, went, studied, ate หรือ played', 'That verb is still in the present. Try watched, went, studied, ate, or played.');
    }
    return feedback('ใส่คำบอกอดีตสักคำ เช่น yesterday, went หรือ watched', 'Add a past marker such as yesterday, went, or watched.');
  }

  if (stepId === 'pie-add') {
    if (/(?<![0-9])17(?![0-9])/.test(value)) return feedback('17 คือเอา 12 ไปบวก 5 อีกรอบ ฝั่งที่ถูกคือลบ 5 ออกจาก 12', '17 adds 5 to 12 again. Subtract 5 from 12 instead.');
    if (/(?<![0-9])5(?![0-9])/.test(value) && !/(?<![0-9])7(?![0-9])/.test(value)) return feedback('5 คือตัวที่บวกอยู่กับ x อยู่แล้ว คำตอบคือค่าที่เหลือหลังย้าย 5 ไป', '5 is already the number added to x. The answer is what remains after moving 5.');
    if (/(?<![0-9])7(?![0-9])/.test(value)) return { ok: true };
    return feedback('ยังไม่ใช่ค่าของ x ลองลบ 5 ออกจาก 12 แล้วส่งจำนวนนั้น', 'That is not x yet. Subtract 5 from 12 and send that number.');
  }

  if (stepId === 'pie-mul') {
    if (/(?<![0-9])16(?![0-9])/.test(value)) return feedback('16 คือเอา 8 ไปคูณ 2 ข้อนี้ต้องหารทั้งสองข้างด้วย 2', '16 multiplies 8 by 2. This one needs both sides divided by 2.');
    if (/(?<![0-9])2(?![0-9])/.test(value) && !/(?<![0-9])4(?![0-9])/.test(value)) return feedback('2 คือตัวที่คูณ x อยู่ ไม่ใช่ค่าของ x ลอง 8 หาร 2', '2 is the multiplier, not x. Try 8 divided by 2.');
    if (/(?<![0-9])4(?![0-9])/.test(value)) return { ok: true };
    return feedback('ยังไม่ตรง หาร 8 ด้วย 2 แล้วส่งผลลัพธ์', 'Not that number. Divide 8 by 2 and send the result.');
  }

  if (stepId === 'pie-method') {
    const hasSub = /ลบ|subtract|minus|ลบห้า|ลบ 5/i.test(value);
    const hasDiv = /หาร|divide|หารสอง|หาร 2/i.test(value);
    if (hasSub && hasDiv) return { ok: true };
    if (hasSub || hasDiv) return feedback('มีหนึ่งการกระทำแล้ว ขอทั้งข้อบวกที่ย้อนด้วยลบ และข้อคูณที่ย้อนด้วยหาร', 'One operation is here. Include both: addition undone by subtraction, and multiplication undone by division.');
    return feedback('บอกชื่อการกระทำได้เลย เช่น ข้อแรกลบ ข้อสองหาร', 'Name the operations, such as subtract for the first and divide for the second.');
  }

  if (stepId === 'pie-forty') {
    if (/(?<![0-9])60(?![0-9])/.test(value) && !/(?<![0-9])40(?![0-9])/.test(value)) return feedback('60 คือราคารวมของสมุด เงินทอนต้องเอา 100 ลบด้วย 60 อีกที', '60 is the total price. Change still needs 100 minus 60.');
    if (/(?<![0-9])80(?![0-9])/.test(value)) return feedback('80 ยังไม่ตรงกับ 20 คูณ 3 ลองหาราคารวมก่อน แล้วค่อยลบจาก 100', '80 does not match 20 times 3. Find the total first, then subtract it from 100.');
    if (/(?<![0-9])20(?![0-9])/.test(value) && !/(?<![0-9])40(?![0-9])/.test(value)) return feedback('20 คือราคาเล่มเดียว โจทย์ซื้อ 3 เล่ม', '20 is the price of one notebook. The problem buys 3.');
    if (/(?<![0-9])40(?![0-9])/.test(value)) return { ok: true };
    return feedback('ยังไม่ใช่เงินทอน หา 20 × 3 ให้ได้ก่อน แล้วเอา 100 ไปลบ', 'That is not the change yet. Find 20 × 3, then subtract it from 100.');
  }

  if (stepId === 'nova-steam') {
    if (/ไอ|ไอน้ำ|แก๊ส|ก๊าซ|steam|vapor|vapour|gas/i.test(value)) return { ok: true };
    return feedback('คิดถึงสิ่งที่ลอยเหนือหม้อตอนน้ำเดือด เรียกว่าไอน้ำ', 'Think of what rises above a boiling pot. It is called steam.');
  }

  if (stepId === 'time-compare') {
    if (value.length >= 8) return { ok: true };
    return feedback('ขออีกนิด บอกอย่างน้อยหนึ่งจุดที่สองฝั่งมองไม่เหมือนกัน', 'A little more. Name one point the two sides do not see the same way.');
  }

  if (stepId === 'bit-write' || stepId === 'bit-limit') {
    const longEnough = value.length >= 12;
    const hasTask = /สรุป|อธิบาย|เขียน|ตรวจ|แปล|ช่วย|summar|explain|write|draft|check|translat/i.test(value);
    const hasLimit = /[0-9]|ไม่เกิน|ข้อ|คำ|สั้น|bullet|word|under|limit/i.test(value);
    if (stepId === 'bit-write' && longEnough && hasTask) return { ok: true };
    if (stepId === 'bit-limit' && longEnough && hasTask && hasLimit) return { ok: true };
    if (stepId === 'bit-limit' && longEnough && hasTask) return feedback('งานชัดแล้ว ใส่ข้อจำกัดอีกหนึ่งอย่าง เช่น จำนวนข้อหรือความยาว', 'The task is clear. Add one limit, such as a count or a length.');
    return feedback('ทำให้เห็นงานในประโยค เช่น ช่วยสรุป แล้วบอกว่าอยากได้แบบไหน', 'Show the task in the sentence, such as “summarize”, and say what shape you want.');
  }

  return feedback('ส่งมาอีกครั้งได้ ฉันยังจับคำตอบไม่ครบ', 'Send it once more. I do not have the full answer yet.');
}

function say(pair, lang) {
  return pair[lang] ?? pair.th;
}

export function tutorReply({ lesson, teacher, progress, text = '', action = 'message', lang = 'th' }) {
  const step = lesson.steps[Math.min(progress.step, lesson.steps.length - 1)];
  if (progress.passed && action === 'message') {
    return { messages: [say(teacher.afterPass, lang)] };
  }
  if (action === 'image') return { messages: [say(teacher.onImage, lang)] };
  if (action === 'hint') {
    const hints = step.hints.length ? step.hints : [step.explain];
    const hint = hints[progress.hints % hints.length];
    return { messages: [say(hint, lang)], hints: progress.hints + 1 };
  }
  if (action === 'explain') return { messages: [say(step.explain, lang)] };

  const result = evaluate(step.id, text);
  if (!result.ok) return { messages: [say(result.feedback, lang)] };

  const success = say(step.success, lang);
  const nextIndex = progress.step + 1;
  if (nextIndex >= lesson.steps.length) {
    return { messages: [success, say(lesson.closing, lang)], step: progress.step, passed: true };
  }
  return {
    messages: [success, say(lesson.steps[nextIndex].prompt, lang)],
    step: nextIndex,
    hints: 0,
  };
}

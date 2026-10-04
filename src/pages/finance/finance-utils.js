export function instructorForOrder(data, order) {
  const course = data.courses.find((item) => item.id === order.courseId);
  return course?.instructorId ? data.users.find((user) => user.id === course.instructorId) : null;
}

export function isReferralOrder(order) {
  return Boolean(order.referralLinkId || order.referralCode);
}

export function instructorShareForOrder(data, order) {
  if (order.status !== 'paid') return 0;
  if (order.instructorShareAmount != null && Number.isFinite(Number(order.instructorShareAmount))) return Number(order.instructorShareAmount);
  const instructor = instructorForOrder(data, order);
  if (!instructor) return 0;
  const rate = Number(order.instructorSharePercent ?? (isReferralOrder(order) ? instructor.referralSharePercent : instructor.baseSharePercent));
  return Math.round(Number(order.amount) * rate) / 100;
}

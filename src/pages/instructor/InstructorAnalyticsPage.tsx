import React, { useMemo, useState } from 'react';
import { Alert, Avatar, Button, Card, Descriptions, Drawer, Empty, Input, Select, Space, Table, Tag, Tabs, Typography } from 'antd';
import type { TableProps } from 'antd';
import { DownloadOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useSearchParams } from 'react-router-dom';
import { getBusinessReport, REPORT_TODAY, rangeError, shiftDate } from '../../api/businessAnalytics';
import type { ReportCourse, ReportRange } from '../../api/businessAnalytics';
import { createBusinessDemo } from '../../mocks/businessAnalytics';
import { instructorComparisonDemoRows } from '../../mocks/instructorComparisonDemo';
import { downloadCsv } from '../../lib/reportCsv';
import { firstSubmittedAttempt } from '../../api/assessmentComparison';
import { ReportChart } from '../admin/business/ReportChart';
import { ReportControls } from '../admin/business/ReportControls';
import {
  getAssessmentSummaries, getInstructorLearners, getInstructorOverview, getInstructorPair,
  safeComparisonSet, scopeInstructorData, stageLabel, validateInstructorCourse,
} from '../../api/instructorAnalytics';
import type { InstructorAnalyticsData, InstructorAttempt, InstructorUser } from '../../api/instructorAnalytics';
import './instructor-analytics.css';

const { Text, Title } = Typography;
const tabItems = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'interest', label: 'ความสนใจคอร์ส' },
  { key: 'assessments', label: 'แบบฝึกหัด' },
  { key: 'comparison', label: 'ก่อน–หลังเรียน' },
  { key: 'learners', label: 'ผู้เรียน' },
];
type TabKey = typeof tabItems[number]['key'];
const isTabKey = (value: string | null): value is TabKey => tabItems.some((tab) => tab.key === value);
const thaiNumber = (value: number) => value.toLocaleString('th-TH', { maximumFractionDigits: 1 });
const displayedAverage = (value: number | null) => value === null ? '—' : thaiNumber(Math.round(value * 10) / 10);

export function InstructorAnalyticsPage({ data, currentUser }: { data: InstructorAnalyticsData; currentUser: InstructorUser }) {
  const [params, setParams] = useSearchParams();
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [demoInterest, setDemoInterest] = useState(false);
  const [demoComparison, setDemoComparison] = useState(false);
  const tabParam = params.get('tab');
  const activeTab: TabKey = isTabKey(tabParam) ? tabParam : 'overview';
  const requestedCourseId = params.get('course');
  const scope = useMemo(() => scopeInstructorData(data, currentUser.id), [data, currentUser.id]);
  const invalidCourse = Boolean(requestedCourseId && !validateInstructorCourse(scope, requestedCourseId));
  const selectedCourse = requestedCourseId && !invalidCourse ? requestedCourseId : 'all';
  const setParamsKeeping = (values: Record<string, string | null>) => setParams((previous) => {
    const next = new URLSearchParams(previous);
    for (const [key, value] of Object.entries(values)) value === null ? next.delete(key) : next.set(key, value);
    return next;
  });
  const overview = useMemo(() => getInstructorOverview(data, scope), [data, scope]);
  const courseRows = selectedCourse === 'all' ? overview.courseRows : overview.courseRows.filter((row) => row.course.id === selectedCourse);
  const visibleCourseIds = new Set(courseRows.map((row) => row.course.id));
  const assessmentRows = useMemo(() => getAssessmentSummaries(scope, selectedCourse), [scope, selectedCourse]);
  const learnerRows = useMemo(() => getInstructorLearners(scope, selectedCourse), [scope, selectedCourse]);

  const comparisonCourseId = selectedCourse === 'all' ? '' : selectedCourse;
  const sets = (data.comparisonSets ?? []).filter((set) => set.courseId === comparisonCourseId && scope.courseIds.has(set.courseId));
  const requestedSetId = params.get('set');
  const comparisonSet = comparisonCourseId ? safeComparisonSet(data, scope, comparisonCourseId, requestedSetId ?? sets[0]?.id) : null;
  const comparison = comparisonSet ? getInstructorPair(scope, comparisonSet) : null;
  const demoMatchedRows = instructorComparisonDemoRows.filter((row) => row.status === 'matched');
  const demoAverage = demoMatchedRows.reduce((total, row) => total + (row.diff ?? 0), 0) / Math.max(1, demoMatchedRows.length);
  const showingComparisonDemo = demoComparison && selectedCourse !== 'all' && sets.length === 0;
  const preQuiz = comparisonSet ? scope.quizzes.find((quiz) => quiz.id === comparisonSet.preQuizId && quiz.courseId === comparisonCourseId) : undefined;
  const postQuiz = comparisonSet ? scope.quizzes.find((quiz) => quiz.id === comparisonSet.postQuizId && quiz.courseId === comparisonCourseId) : undefined;

  const reportCourses: ReportCourse[] = scope.courses.map((course) => ({ id: course.id, title: course.title, price: course.price ?? 0, status: course.status }));
  const range: ReportRange = { start: params.get('start') ?? shiftDate(REPORT_TODAY, -29), end: params.get('end') ?? REPORT_TODAY, courseId: selectedCourse };
  const reportError = rangeErrorForOwner(range, scope.courseIds);
  const businessReport = useMemo(() => {
    if (reportError) return null;
    const source = createBusinessDemo(reportCourses.filter((course) => selectedCourse === 'all' || course.id === selectedCourse));
    return getBusinessReport(source, reportCourses.filter((course) => selectedCourse === 'all' || course.id === selectedCourse), range);
  }, [reportError, reportCourses, selectedCourse, range.start, range.end]);

  const learner = learnerRows.find((row) => row.learnerId === learnerId);
  const learnerAttempts = learner ? scope.attempts.filter((attempt) => attempt.userId === learner.learnerId && visibleCourseIds.has(attempt.courseId)) : [];
  const reportRangeSet = (values: Record<string, string>) => setParamsKeeping(values);
  const onTabChange = (key: string) => { if (isTabKey(key)) setParamsKeeping({ tab: key }); };
  const setCourse = (value: string) => { setParamsKeeping({ course: value === 'all' ? null : value, set: null }); };

  const overviewColumns: TableProps<typeof courseRows[number]>['columns'] = [
    { title: 'คอร์ส', key: 'course', render: (_, row) => <div className="ia-course-cell">{row.course.cover && <img src={row.course.cover} alt=""/>}<div><strong>{row.course.title}</strong><Text type="secondary">ข้อมูลสะสมในต้นแบบ</Text></div></div> },
    { title: 'ผู้เรียน', dataIndex: 'enrolled', key: 'enrolled', render: (count: number) => `${thaiNumber(count)} คน` },
    { title: 'เรียนจบ', key: 'completion', render: (_, row) => `${row.completionRate}% · ${row.completed} คน` },
    { title: 'ส่งแบบฝึกหัด', dataIndex: 'submitted', key: 'submitted', render: (count: number) => `${thaiNumber(count)} ครั้ง` },
    { title: 'รอตรวจ', dataIndex: 'pending', key: 'pending', render: (count: number, row) => count ? <Link to={`/teach/reviews?course=${encodeURIComponent(row.course.id)}&returnTo=${encodeURIComponent(`/teach/analytics?tab=overview&course=${row.course.id}`)}`}>{count} งาน · ตรวจคำตอบ</Link> : '0' },
  ];

  const assessmentColumns: TableProps<typeof assessmentRows[number]>['columns'] = [
    { title: 'แบบฝึกหัด', key: 'quiz', render: (_, row) => <><strong>{row.quiz.title}</strong><Text type="secondary" className="ia-cell-sub">{stageLabel(row.stage)} · ข้อมูลสะสมในต้นแบบ</Text></> },
    { title: 'ผู้ส่งไม่ซ้ำ', dataIndex: 'submitters', key: 'submitters' },
    { title: 'คะแนนเฉลี่ย', key: 'average', render: (_, row) => row.validN ? `${displayedAverage(row.average)}%` : '—' },
    { title: 'มัธยฐาน', key: 'median', render: (_, row) => row.validN ? `${displayedAverage(row.median)}%` : '—' },
    { title: 'ผ่าน', key: 'pass', render: (_, row) => row.passRate === null ? '—' : `${Math.round(row.passRate)}% · ${row.validN} คนมีคะแนน` },
    { title: 'รอตรวจ', dataIndex: 'pendingCount', key: 'pendingCount' },
    { title: 'ผลรายข้อ', key: 'detail', render: (_, row) => <Button size="small" onClick={() => { setLearnerId(`quiz:${row.quiz.id}`); }}>ดูผลรายข้อ</Button> },
  ];

  const learnerColumns: TableProps<typeof learnerRows[number]>['columns'] = [
    { title: 'ผู้เรียน', key: 'learner', render: (_, row) => <Space><Avatar src={row.learner?.avatar} icon={<UserOutlined/>}/><span>{row.learner?.name}</span></Space> },
    { title: 'คอร์สในขอบเขต', key: 'courses', render: (_, row) => row.enrollments.map((entry) => scope.courses.find((course) => course.id === entry.courseId)?.title).filter(Boolean).join('、') },
    { title: 'ความคืบหน้า', key: 'progress', render: (_, row) => row.progressByCourse.map((progress) => `${scope.courses.find((course) => course.id === progress.courseId)?.title ?? 'คอร์ส'} ${progress.percent === null ? 'ไม่มีรายการบทเรียน' : `${progress.percent}%`}`).join(' · ') },
    { title: 'ผลล่าสุด', key: 'score', render: (_, row) => row.latestScore === null ? '—' : `${thaiNumber(row.latestScore)}%` },
    { title: 'ประวัติ', key: 'history', render: (_, row) => <Button size="small" onClick={() => setLearnerId(row.learnerId)}>ดูประวัติ</Button> },
  ];

  if (invalidCourse) return <div className="instructor-analytics-page"><Alert type="error" showIcon title="ไม่พบคอร์สที่เลือก หรือคุณไม่มีสิทธิ์ดูคอร์สนี้" description="เลือกคอร์สจากรายการคอร์สที่รับผิดชอบเพื่อดูรายงาน"/><Button type="link" onClick={() => setCourse('all')}>กลับไปดูทุกคอร์สของฉัน</Button></div>;

  return <div className="instructor-analytics-page">
    <header className="ia-header">
      <div><Text className="ia-eyebrow">สตูดิโอผู้สอน</Text><Title level={2}>ภาพรวมคอร์สของฉัน</Title><Text type="secondary">ดูเฉพาะคอร์สที่คุณรับผิดชอบ · ผลการเรียนเป็นข้อมูลสะสมในต้นแบบ</Text></div>
      <label className="ia-course-filter">คอร์ส<Select aria-label="คอร์สที่รับผิดชอบ" value={selectedCourse} onChange={setCourse} options={[{ value: 'all', label: 'ทุกคอร์สที่รับผิดชอบ' }, ...scope.courses.map((course) => ({ value: course.id, label: course.title }))]}/></label>
    </header>
    <Tabs activeKey={activeTab} items={tabItems} onChange={onTabChange} className="ia-tabs"/>

    {activeTab === 'overview' && <section aria-label="ภาพรวมผลการเรียน">
      <div className="ia-kpis">
        <Metric label="ผู้เรียนไม่ซ้ำ" value={new Set(scope.enrollments.filter((row) => visibleCourseIds.has(row.courseId)).map((row) => row.userId)).size} detail="ผู้เรียนในคอร์สที่เลือก"/>
        <Metric label="การลงทะเบียน" value={courseRows.reduce((sum, row) => sum + row.enrolled, 0)} detail="ข้อมูลสะสมในต้นแบบ"/>
        <Metric label="เรียนจบ" value={courseRows.reduce((sum, row) => sum + row.completed, 0)} detail="คนต่อคอร์ส · สะสม"/>
        <Metric label="คำตอบรอตรวจ" value={scope.attempts.filter((attempt) => visibleCourseIds.has(attempt.courseId) && attempt.status === 'submitted' && attempt.essayStatus === 'pending').length} detail="เปิดคิวตรวจเพื่อดำเนินการ"/>
      </div>
      <section className="ia-section"><div className="ia-section-title"><div><Title level={4}>ภาพรวมรายคอร์ส</Title><Text type="secondary">ส่งแบบฝึกหัดนับทุกครั้ง ส่วนผลผ่านใช้เฉพาะ first submission ที่มีคะแนน</Text></div><Button onClick={() => exportOverview(courseRows)} icon={<DownloadOutlined/>}>ดาวน์โหลด CSV รายคอร์ส</Button></div><Table rowKey={(row) => row.course.id} dataSource={courseRows} columns={overviewColumns} pagination={{ pageSize: 8 }} scroll={{ x: 680 }} locale={{ emptyText: 'ยังไม่มีคอร์สในความดูแล' }}/></section>
    </section>}

    {activeTab === 'interest' && <section className="ia-section">
        <div className="ia-section-title"><div><Title level={4}>ความสนใจคอร์ส</Title><Text type="secondary">ผู้เข้าชม · sessions · การลงทะเบียน · รายการซื้อ และช่วงเวลาที่มีกิจกรรม</Text></div>{!demoInterest && <Button type="primary" onClick={() => setDemoInterest(true)}>ดูข้อมูลตัวอย่าง</Button>}{demoInterest && <Button onClick={() => setDemoInterest(false)}>ปิดข้อมูลตัวอย่าง</Button>}</div>
      {demoInterest ? <>
        <ReportControls courses={reportCourses} range={{ ...range, courseId: selectedCourse }} set={reportRangeSet} error={reportError}/>
        <div className="ia-kpis ia-interest-metrics"><Metric label="ผู้เข้าชม" value={businessReport?.visitors ?? '—'} detail="ผู้ใช้ในข้อมูลตัวอย่าง"/><Metric label="Sessions" value={businessReport?.daily.reduce((sum, row) => sum + row.sessions, 0) ?? '—'} detail="ข้อมูลตัวอย่าง"/><Metric label="ลงทะเบียน" value={businessReport?.enrollments ?? '—'} detail="รายการในช่วงวันที่"/><Metric label="ซื้อคอร์ส" value={businessReport?.purchases ?? '—'} detail="จำนวนรายการ · ไม่มีข้อมูลรายได้"/></div>
        <div className="ia-charts">{(['visitors', 'sessions', 'enrollments', 'purchases'] as const).map((key) => <section className="ia-section" key={key}><ReportChart title={{ visitors: 'ผู้เข้าชม', sessions: 'Sessions', enrollments: 'การลงทะเบียน', purchases: 'รายการซื้อ' }[key]} unit="รายการ" points={(businessReport?.daily ?? []).map((row) => ({ date: row.date, value: row.covered ? row[key] : null }))}/></section>)}</div>
        <div className="ia-section"><Title level={5}>ช่วงเวลาที่มีการเรียนและซื้อคอร์ส</Title><Text type="secondary">ข้อมูลจำลอง · เวลา Asia/Bangkok</Text><Heatmap rows={businessReport?.heatmap ?? []} title="การเรียน"/><Heatmap rows={businessReport?.purchaseHeatmap ?? []} title="การซื้อ"/></div>
        <Alert type="info" showIcon title="ข้อมูลจำลองสำหรับดูแนวโน้มเท่านั้น" description="ข้อมูลนี้ไม่ใช่ข้อมูลการใช้งานจริง ไม่แสดงรายได้หรือส่วนแบ่งของผู้สอน"/>
      </> : <div className="ia-empty"><Empty description="ข้อมูลความสนใจเป็นข้อมูลจำลองและจะแสดงเมื่อกดปุ่มดูข้อมูลตัวอย่าง"/><Text type="secondary">การเลือกคอร์สจะจำกัดตัวอย่างให้อยู่ในคอร์สที่คุณรับผิดชอบ</Text></div>}
    </section>}

    {activeTab === 'assessments' && <section className="ia-section"><div className="ia-section-title"><div><Title level={4}>ผลแบบฝึกหัด</Title><Text type="secondary">สรุป first submission ต่อผู้เรียนและแบบฝึกหัด คะแนน pending ยังไม่รวมในค่าเฉลี่ย</Text></div><Button onClick={() => exportAssessments(assessmentRows)} icon={<DownloadOutlined/>}>ดาวน์โหลด CSV แบบฝึกหัด</Button></div><Table rowKey={(row) => row.quiz.id} dataSource={assessmentRows} columns={assessmentColumns} pagination={{ pageSize: 8 }} scroll={{ x: 900 }} locale={{ emptyText: 'ยังไม่มีแบบฝึกหัดในคอร์สที่เลือก' }}/>
      {assessmentRows.map((row) => <details className="ia-item-breakdown" key={row.quiz.id}><summary>{row.quiz.title} · ผลรายข้อแบบเลือกตอบ</summary>{row.choices.length ? <div className="ia-table-scroll"><table><thead><tr><th>ข้อ</th><th>ตอบถูก</th><th>ตอบผิด</th><th>ข้าม</th><th>ถูก / มีคำตอบ</th></tr></thead><tbody>{row.choices.map((choice, index) => <tr key={choice.question.id}><th>{index + 1}. {choice.question.prompt}</th><td>{choice.correct}</td><td>{choice.incorrect}</td><td>{choice.skipped}</td><td>{choice.accuracy === null ? '—' : `${Math.round(choice.accuracy)}%`}</td></tr>)}</tbody></table></div> : <Text type="secondary">ไม่มีข้อเลือกตอบ · ข้อเขียนและรูปภาพตรวจจากคำตอบรายบุคคล โดยไม่มีคะแนนรายข้อในข้อมูล</Text>}</details>)}
    </section>}

    {activeTab === 'comparison' && <section className="ia-section">
      <div className="ia-section-title"><div><Title level={4}>เปรียบเทียบก่อน–หลังเรียน</Title><Text type="secondary">การเปรียบเทียบเชิงพรรณนา ไม่ยืนยันเหตุและผลของการเรียน</Text></div><Space wrap><label>ชุดเปรียบเทียบ<Select aria-label="ชุดเปรียบเทียบก่อน–หลัง" disabled={selectedCourse === 'all' || sets.length === 0} value={comparisonSet?.id} onChange={(value) => setParamsKeeping({ set: value })} options={sets.map((set) => ({ value: set.id, label: set.title }))} placeholder="เลือกชุดเปรียบเทียบ"/></label>{comparison && <Button onClick={() => exportComparison(comparison.rows, scope.users)} icon={<DownloadOutlined/>}>ดาวน์โหลด CSV ก่อน–หลัง</Button>}</Space></div>
      {selectedCourse === 'all' ? <Empty description="เลือกคอร์สเดียวก่อนเพื่อดูผลก่อน–หลัง"/> : !sets.length && !showingComparisonDemo ? <div className="ia-empty"><Empty description="คอร์สนี้ยังไม่มีชุดเปรียบเทียบที่กำหนดไว้ จึงไม่เดาคู่จากชื่อแบบฝึกหัด"/><Button type="primary" onClick={() => setDemoComparison(true)}>ดูข้อมูลตัวอย่าง</Button></div> : showingComparisonDemo ? <>
        <Alert type="info" showIcon title="ตัวอย่างจำลองแบบอ่านอย่างเดียว" description="ไม่ใช่ผลของผู้เรียนในคอร์ส และไม่ถูกบันทึกหรือรวมกับข้อมูลจากระบบ"/>
        <div className="ia-kpis"><Metric label="คะแนนเฉลี่ยก่อนเรียน" value={`${displayedAverage(demoMatchedRows.reduce((sum, row) => sum + (row.preScore ?? 0), 0) / demoMatchedRows.length)}%`} detail={`คำนวณจาก matched n = ${demoMatchedRows.length}`}/><Metric label="คะแนนเฉลี่ยหลังเรียน" value={`${displayedAverage(demoMatchedRows.reduce((sum, row) => sum + (row.postScore ?? 0), 0) / demoMatchedRows.length)}%`} detail={`คำนวณจาก matched n = ${demoMatchedRows.length}`}/><Metric label="Paired Gain" value={`${demoAverage > 0 ? '+' : ''}${displayedAverage(demoAverage)} จุดเปอร์เซ็นต์`} detail={`matched n = ${demoMatchedRows.length}`}/><Metric label="Coverage" value={`${demoMatchedRows.length} / ${instructorComparisonDemoRows.length}`} detail="รอตรวจ 1 · กลุ่มไม่ครบ 4"/></div>
        <PairedChart rows={demoMatchedRows.map((row) => ({ id: row.learnerId, name: row.learnerName, pre: row.preScore ?? 0, post: row.postScore ?? 0 }))}/>
        <div className="ia-table-scroll"><table className="ia-paired-table"><thead><tr><th>ผู้เรียน</th><th>ก่อนเรียน (%)</th><th>หลังเรียน (%)</th><th>ส่วนต่าง (จุดเปอร์เซ็นต์)</th><th>สถานะ</th></tr></thead><tbody>{instructorComparisonDemoRows.map((row) => <tr key={row.learnerId}><th>{row.learnerName}</th><td>{row.preScore === null ? '—' : thaiNumber(row.preScore)}</td><td>{row.postScore === null ? '—' : thaiNumber(row.postScore)}</td><td>{row.diff === null ? '—' : `${row.diff > 0 ? '+' : ''}${thaiNumber(row.diff)}`}</td><td><StatusTag status={row.status}/></td></tr>)}</tbody></table></div>
        <Button onClick={() => setDemoComparison(false)}>ปิดข้อมูลตัวอย่าง</Button>
      </> : !sets.length ? <Empty description="คอร์สนี้ยังไม่มีชุดเปรียบเทียบที่กำหนดไว้"/> : !comparisonSet || !comparison ? <Empty description="ไม่พบชุดเปรียบเทียบในคอร์สนี้ กรุณาเลือกชุดจากรายการ"/> : <>
        <div className="ia-assessment-pair"><span>ก่อนเรียน · {preQuiz?.title}</span><b aria-hidden="true">→</b><span>หลังเรียน · {postQuiz?.title}</span></div>
        <div className="ia-kpis"><Metric label="คะแนนเฉลี่ยก่อนเรียน" value={comparison.matchedN ? `${displayedAverage(comparison.preAverage)}%` : '—'} detail={`คำนวณจาก matched n = ${comparison.matchedN}`}/><Metric label="คะแนนเฉลี่ยหลังเรียน" value={comparison.matchedN ? `${displayedAverage(comparison.postAverage)}%` : '—'} detail={`คำนวณจาก matched n = ${comparison.matchedN}`}/><Metric label="Paired Gain" value={comparison.matchedN ? `${(comparison.averageGain ?? 0) > 0 ? '+' : ''}${displayedAverage(comparison.averageGain)} จุดเปอร์เซ็นต์` : '—'} detail={comparison.matchedN ? `matched n = ${comparison.matchedN}` : 'ยังไม่มีผลที่จับคู่ครบ'}/><Metric label="Coverage" value={`${comparison.matchedN} / ${comparison.totalEnrolled}`} detail={`รอตรวจ ${comparison.pendingCount} · กลุ่มไม่ครบ ${comparison.unmatchedCount}`}/></div>
        {comparison.matchedN > 0 && <PairedChart rows={comparison.rows.filter((row) => row.status === 'matched').map((row) => ({ id: row.learnerId, name: scope.users.find((user) => user.id === row.learnerId)?.name ?? 'ผู้เรียน', pre: row.preScore ?? 0, post: row.postScore ?? 0 }))}/>}
        <div className="ia-table-scroll"><table className="ia-paired-table"><thead><tr><th>ผู้เรียน</th><th>ก่อนเรียน (%)</th><th>หลังเรียน (%)</th><th>ส่วนต่าง (จุดเปอร์เซ็นต์)</th><th>สถานะ</th><th>การทำงาน</th></tr></thead><tbody>{comparison.rows.map((row) => <tr key={row.learnerId}><th><Space><Avatar src={scope.users.find((user) => user.id === row.learnerId)?.avatar} icon={<UserOutlined/>}/>{scope.users.find((user) => user.id === row.learnerId)?.name ?? 'ผู้เรียน'}</Space></th><td>{row.preScore === null ? '—' : thaiNumber(row.preScore)}</td><td>{row.postScore === null ? '—' : thaiNumber(row.postScore)}</td><td>{row.diff === null ? '—' : `${row.diff > 0 ? '+' : ''}${thaiNumber(row.diff)}`}</td><td><StatusTag status={row.status}/></td><td><Space wrap>{row.preAttempt && <Button size="small" onClick={() => setLearnerId(row.learnerId)}>ดูคำตอบ / ประวัติ</Button>}{row.preAttempt?.essayStatus === 'pending' && <Link to={`/teach/attempts/${row.preAttempt.id}/grade?returnTo=${encodeURIComponent(locationSearchUrl(params, 'comparison'))}`}>ตรวจงานก่อนเรียน</Link>}{row.postAttempt?.essayStatus === 'pending' && <Link to={`/teach/attempts/${row.postAttempt.id}/grade?returnTo=${encodeURIComponent(locationSearchUrl(params, 'comparison'))}`}>ตรวจงานหลังเรียน</Link>}{row.postAttempt && !row.preAttempt && <Button size="small" onClick={() => setLearnerId(row.learnerId)}>ดูประวัติ</Button>}</Space></td></tr>)}</tbody></table></div>
        <Text type="secondary">Paired Gain คือค่าเฉลี่ย (คะแนนหลัง − คะแนนก่อน) เฉพาะผู้เรียนที่มีคะแนนตรวจครบทั้งคู่ · คัด first submission ตามเวลาส่ง · ผลคะแนนสะสมไม่ขึ้นกับช่วงวันที่ทราฟฟิก</Text>
      </>}
    </section>}

    {activeTab === 'learners' && <section className="ia-section"><div className="ia-section-title"><div><Title level={4}>ผู้เรียนในคอร์สของฉัน</Title><Text type="secondary">ประวัติแสดงเฉพาะคอร์สที่รับผิดชอบและคอร์สที่เลือก</Text></div><Button onClick={() => exportLearners(learnerRows)} icon={<DownloadOutlined/>}>ดาวน์โหลด CSV ผู้เรียน</Button></div><Table rowKey="learnerId" dataSource={learnerRows} columns={learnerColumns} pagination={{ pageSize: 10 }} scroll={{ x: 680 }} locale={{ emptyText: 'ยังไม่มีผู้เรียนในคอร์สที่เลือก' }}/></section>}

    <Drawer title={learnerId?.startsWith('quiz:') ? 'ผลรายข้อและคำตอบ' : 'ประวัติผู้เรียนในคอร์สที่รับผิดชอบ'} aria-label={learnerId?.startsWith('quiz:') ? 'ผลรายข้อและคำตอบ' : 'รายละเอียดผู้เรียนและคำตอบ'} open={Boolean(learnerId)} onClose={() => setLearnerId(null)} width={Math.min(720, window.innerWidth - 24)}>
      {learnerId?.startsWith('quiz:') ? <QuizDrawer quizId={learnerId.slice(5)} scope={scope} onOpenLearner={setLearnerId}/> : learner ? <><Space><Avatar size={48} src={learner.learner?.avatar} icon={<UserOutlined/>}/><div><strong>{learner.learner?.name}</strong><Text type="secondary" className="ia-cell-sub">{learner.enrollments.length} คอร์สในขอบเขตที่เลือก</Text></div></Space><div className="ia-drawer-courses">{learner.enrollments.map((row) => <Tag key={row.courseId}>{scope.courses.find((course) => course.id === row.courseId)?.title}</Tag>)}</div><Descriptions column={1} size="small" items={learnerAttempts.slice().sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? '')).map((attempt) => ({ key: attempt.id, label: scope.quizzes.find((quiz) => quiz.id === attempt.quizId)?.title ?? 'แบบฝึกหัด', children: <AttemptDetail attempt={attempt} quiz={scope.quizzes.find((quiz) => quiz.id === attempt.quizId)}/> }))}/></> : <Empty description="ไม่พบผู้เรียนในคอร์สที่รับผิดชอบ"/>}
    </Drawer>
  </div>;
}

function rangeErrorForOwner(range: ReportRange, courseIds: Set<string>) {
  if (range.courseId !== 'all' && !courseIds.has(range.courseId)) return 'ไม่พบคอร์สที่เลือก กรุณาเลือกคอร์สใหม่';
  return rangeError(range);
}
function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) { return <div className="ia-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function exportOverview(rows: { course: { id: string; title: string }; enrolled: number; completed: number; completionRate: number; submitted: number; pending: number; scored: number; passRate: number | null }[]) { downloadCsv('instructor-course-overview.csv', [['courseId', 'course', 'learners', 'completed', 'completionPercent', 'submittedAttempts', 'pendingReview', 'scoredFirstSubmissions', 'passRatePercent'], ...rows.map((row) => [row.course.id, row.course.title, row.enrolled, row.completed, row.completionRate, row.submitted, row.pending, row.scored, row.passRate === null ? '' : row.passRate])]); }
function exportAssessments(rows: ReturnType<typeof getAssessmentSummaries>) { downloadCsv('instructor-assessments.csv', [['courseId', 'quizId', 'quiz', 'stage', 'firstSubmitters', 'scoredN', 'pending', 'averagePercent', 'medianPercent', 'passRatePercent'], ...rows.map((row) => [row.quiz.courseId, row.quiz.id, row.quiz.title, stageLabel(row.stage), row.submitters, row.validN, row.pendingCount, row.average ?? '', row.median ?? '', row.passRate ?? ''])]); }
function exportLearners(rows: ReturnType<typeof getInstructorLearners>) { downloadCsv('instructor-learners.csv', [['learnerId', 'name', 'courseIds', 'latestScorePercent', 'latestAttemptId'], ...rows.map((row) => [row.learnerId, row.learner?.name ?? '', row.enrollments.map((enrollment) => enrollment.courseId).join(';'), row.latestScore ?? '', row.latestAttempt?.id ?? ''])]); }
function exportComparison(rows: ReturnType<typeof getInstructorPair>['rows'], users: InstructorUser[]) { downloadCsv('instructor-pre-post.csv', [['learnerId', 'learner', 'prePercent', 'postPercent', 'gainPercentagePoints', 'status', 'preAttemptId', 'postAttemptId'], ...rows.map((row) => [row.learnerId, users.find((user) => user.id === row.learnerId)?.name ?? '', row.preScore ?? '', row.postScore ?? '', row.diff ?? '', row.status, row.preAttempt?.id ?? '', row.postAttempt?.id ?? ''])]); }
function locationSearchUrl(params: URLSearchParams, tab: TabKey) { const next = new URLSearchParams(params); next.set('tab', tab); return `/teach/analytics?${next.toString()}`; }
function StatusTag({ status }: { status: string }) { const label: Record<string, string> = { matched: 'จับคู่ครบ', pending_grading: 'รอตรวจ', pre_only: 'มีผลก่อนเรียน', post_only: 'มีผลหลังเรียน', neither: 'ยังไม่ส่งทั้งคู่' }; return <Tag>{label[status] ?? 'ไม่มีข้อมูล'}</Tag>; }
function PairedChart({ rows }: { rows: { id: string; name: string; pre: number; post: number }[] }) {
  const visible = rows.slice(0, 50);
  const x = (index: number) => 36 + index * 34;
  const y = (score: number) => 170 - Math.max(0, Math.min(100, score)) * 1.25;
  return <div className="ia-paired-chart-wrap"><svg className="ia-paired-chart" viewBox={`0 0 ${Math.max(360, visible.length * 34 + 40)} 214`} role="img" aria-label={`กราฟเปรียบเทียบคะแนนก่อนและหลังเรียนของผู้เรียน ${visible.length} คน`}><text x="5" y="16">คะแนน (%)</text>{[0, 50, 100].map((score) => <g key={score}><line x1="32" x2={Math.max(350, visible.length * 34 + 20)} y1={y(score)} y2={y(score)}/><text x="3" y={y(score) + 4}>{score}</text></g>)}{visible.map((row, index) => <g key={row.id} aria-label={`${row.name}: ก่อนเรียน ${row.pre} เปอร์เซ็นต์ หลังเรียน ${row.post} เปอร์เซ็นต์`}><title>{row.name}: ก่อนเรียน {row.pre}% · หลังเรียน {row.post}%</title><line className="ia-paired-connector" x1={x(index)} x2={x(index)} y1={y(row.pre)} y2={y(row.post)}/><circle className="ia-pre-point" cx={x(index)} cy={y(row.pre)} r="5"/><rect className="ia-post-point" x={x(index) - 4} y={y(row.post) - 4} width="8" height="8"/></g>)}</svg><div className="ia-chart-legend"><span><i className="ia-pre-point-key"/> ก่อนเรียน</span><span><i className="ia-post-point-key"/> หลังเรียน</span><Text type="secondary">แสดง {visible.length} จาก {rows.length} คน · ตารางด้านล่างและ CSV แสดงครบ</Text></div></div>;
}
function Heatmap({ rows, title }: { rows: number[][]; title: string }) {
  if (!rows.length) return null;
  const days = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
  const max = Math.max(1, ...rows.flat());
  return <div className="ia-heatmap"><strong>{title}</strong><div className="ia-heat-hours"><span/>{Array.from({ length: 24 }, (_, hour) => <span key={hour}>{hour % 3 === 0 ? `${hour}` : ''}</span>)}</div>{rows.map((row, day) => <div className="ia-heat-row" key={days[day]}><span>{days[day]}</span>{row.map((value, hour) => <i key={hour} title={`${days[day]} ${hour}:00 · ${value}`} aria-label={`${title} ${days[day]} เวลา ${hour}:00 จำนวน ${value}`} style={{ backgroundColor: `rgba(0,116,232,${0.08 + value / max * 0.82})` }}/>)}</div>)}</div>;
}
function QuizDrawer({ quizId, scope, onOpenLearner }: { quizId: string; scope: ReturnType<typeof scopeInstructorData>; onOpenLearner: (id: string) => void }) {
  const quiz = scope.quizzes.find((entry) => entry.id === quizId);
  if (!quiz) return <Empty description="ไม่พบแบบฝึกหัดในคอร์สที่รับผิดชอบ"/>;
  const allAttempts = scope.attempts.filter((attempt) => attempt.quizId === quiz.id && attempt.courseId === quiz.courseId && attempt.status === 'submitted');
  const selectedAttempts = [...new Set(allAttempts.map((attempt) => attempt.userId))].map((userId) => firstSubmittedAttempt(allAttempts.filter((attempt) => attempt.userId === userId))).filter((attempt): attempt is InstructorAttempt => Boolean(attempt));
  return <><Title level={5}>{quiz.title}</Title>{(quiz.questions ?? []).map((question, index) => {
    if (question.type === 'choice') return <div className="ia-question-detail" key={question.id}><strong>ข้อ {index + 1} · {question.prompt}</strong><Text type="secondary">คำตอบถูกต้องตามโจทย์: {question.options?.[question.answer ?? -1] ?? 'ไม่ระบุ'}</Text></div>;
    const submitted = selectedAttempts.filter((attempt) => Object.prototype.hasOwnProperty.call(attempt.answers ?? {}, question.id));
    const pending = submitted.filter((attempt) => attempt.essayStatus === 'pending').length;
    return <div className="ia-question-detail" key={question.id}><strong>ข้อ {index + 1} · {question.prompt}</strong><Text type="secondary">ข้อเขียน/ภาพ · ส่ง {submitted.length} · รอตรวจ {pending} · ไม่มีคะแนนรายข้อในข้อมูลต้นแบบ</Text></div>;
  })}{selectedAttempts.map((attempt) => <Card key={attempt.id} size="small" className="ia-answer-card"><Space direction="vertical"><Button type="link" onClick={() => onOpenLearner(attempt.userId)}>{scope.users.find((user) => user.id === attempt.userId)?.name ?? 'ผู้เรียน'} · เปิดประวัติ</Button><AttemptDetail attempt={attempt} quiz={quiz}/></Space></Card>)}</>;
}
function AttemptDetail({ attempt, quiz }: { attempt: InstructorAttempt; quiz?: { questions?: { id: string; type: string; prompt?: string; options?: string[]; answer?: number }[] } }) {
  const questions = quiz?.questions ?? [];
  return <div className="ia-attempt-detail"><Text type="secondary">{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('th-TH') : 'ไม่ระบุวันส่ง'} · {attempt.essayStatus === 'pending' ? 'รอตรวจ' : attempt.essayStatus === 'graded' ? `ตรวจแล้ว${typeof attempt.finalPercent === 'number' ? ` · ${attempt.finalPercent}%` : ''}` : typeof attempt.percent === 'number' ? `คะแนน ${attempt.percent}%` : 'ไม่มีคะแนน'}</Text>{questions.map((question) => { const answer = attempt.answers?.[question.id]; if (question.type === 'choice') return <div key={question.id}><strong>{question.prompt}</strong><div>คำตอบ: {typeof answer === 'number' ? question.options?.[answer] ?? 'ไม่ระบุ' : 'ข้าม'}</div></div>; const value = answer; const text = typeof value === 'string' ? value : isRecord(value) && typeof value.text === 'string' ? value.text : ''; const images = extractImages(value); return <div key={question.id}><strong>{question.prompt}</strong>{text && <p>{text}</p>}{images.map((image) => <img className="ia-answer-image" key={image} src={image} alt="ภาพคำตอบผู้เรียน"/>)}{!text && images.length === 0 && <Text type="secondary">ยังไม่มีคำตอบ</Text>}</div>; })}{attempt.essayFeedback && <Alert type="info" title="ข้อเสนอแนะผู้สอน" description={attempt.essayFeedback}/>}</div>;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isSafeImageSource(value: string) { return value.startsWith('data:image/') || value.startsWith('https://') || value.startsWith('http://'); }
function extractImages(value: unknown): string[] { if (typeof value === 'string' && isSafeImageSource(value)) return [value]; if (!isRecord(value)) return []; const values: unknown[] = [value.image, ...(Array.isArray(value.images) ? value.images : [])]; return values.flatMap((item) => typeof item === 'string' && isSafeImageSource(item) ? [item] : isRecord(item) && typeof item.url === 'string' && isSafeImageSource(item.url) ? [item.url] : []); }

export interface Certificate {
  id: string;
  code: string;
  courseId: string;
  userId: string;
  issuedAt: string;
  recipientName?: string;
}

export interface CertificateSummary {
  id: string;
  code: string;
  course_id: string;
  course_title: string;
  recipient_name: string;
  issued_at: string;
}

export interface CertificateDetail extends CertificateSummary {
  instructor_name: string;
  download_url?: string;
}

// Compile-time agreement between draft DTOs and actual mock projections.
import type { CurrentUser, CourseDetail, CourseSummary, LoginRequest, CreatePaymentRequest } from '../packages/contracts/src/index.ts';
import { toCurrentUser, toCourseDetail, toCourseSummary } from '../tools/provisional-api/domain.ts';
export const projectUser: (...args: Parameters<typeof toCurrentUser>) => CurrentUser = toCurrentUser;
export const projectSummary: (...args: Parameters<typeof toCourseSummary>) => CourseSummary = toCourseSummary;
export const projectDetail: (...args: Parameters<typeof toCourseDetail>) => CourseDetail = toCourseDetail;
export const loginBody = { identifier: 'learner@example.test', password: 'mock-password-1', audience: 'web' } satisfies LoginRequest;
export const checkoutBody = { course_id: 'crs_mock_002', request_id: 'request-1' } satisfies CreatePaymentRequest;

import type { AuthoringCourseDto, AdminBlogDto, AdminUserSummaryDto } from '../packages/contracts/src/index.ts';
import {authoringView} from '../tools/provisional-api/flow-e-authoring.ts';
import {adminBlogView} from '../tools/provisional-api/flow-h-blog.ts';
import {adminUser} from '../tools/provisional-api/management.ts';
export const projectAuthoring:(...args:Parameters<typeof authoringView>)=>AuthoringCourseDto=authoringView;
export const projectBlog:(...args:Parameters<typeof adminBlogView>)=>AdminBlogDto=adminBlogView;
export const projectAdminUser:(...args:Parameters<typeof adminUser>)=>AdminUserSummaryDto=adminUser;

import { IsIn, IsString, MinLength } from 'class-validator';

/** Exact canonical LoginRequest; no username/provider policy choices. */
export class LoginRequestDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsIn(['web', 'admin'])
  audience!: 'web' | 'admin';
}

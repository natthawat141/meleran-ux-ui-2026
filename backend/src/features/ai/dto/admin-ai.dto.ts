import { IsBoolean, IsString, MaxLength } from 'class-validator';

export class AiSupportRequestDto { @IsBoolean() ai_enabled!: boolean }
export class TranscriptRequestDto { @IsString() @MaxLength(200000) text!: string }
export interface AdminTranscriptDto {
  item_id: string;
  text: string;
  edited_by: string | null;
  edited_at: string | null;
}

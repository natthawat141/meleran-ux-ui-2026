import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CertificatesController } from './certificates.controller';
import { CertificateReadService } from './certificate-read.service';
import { CompletionIssuer } from './public/index';

@Module({ imports: [AuthModule], controllers: [CertificatesController], providers: [CertificateReadService,CompletionIssuer],exports:[CompletionIssuer] })
export class CertificatesModule {}

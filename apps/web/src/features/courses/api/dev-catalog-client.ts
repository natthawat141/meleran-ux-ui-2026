import { apiClient, apiConfig } from '../../../shared/api/client';
import { createCatalogApi } from './catalog-api.ts';
export const devCatalogBasePath = apiConfig.baseUrl;
export const devCatalogApi = createCatalogApi(apiClient);

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;

export interface ValidationErrorDetail {
  path: string;
  message: string;
  code?: string;
}

export interface AppErrorOptions {
  message: string;
  statusCode: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

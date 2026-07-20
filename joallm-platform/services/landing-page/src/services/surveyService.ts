const API_BASE_URL = 'http://localhost:3001/api';

export interface SurveyData {
  userType: 'developer' | 'business' | 'analyst' | 'casual';
  companySize?: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  industry?: string;
  currentTools: string[];
  primaryUseCase: string;
  painPoints: string[];
  featureRequests: string[];
  budget: 'free' | 'under-100' | '100-500' | '500-2000' | '2000+';
  contactEmail?: string;
  additionalComments?: string;
  source: 'landing-page';
}

export interface SurveyResponse {
  success: boolean;
  message: string;
  surveyId: string;
}

export class SurveyService {
  static async submitSurvey(surveyData: SurveyData): Promise<SurveyResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/survey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...surveyData,
          source: 'landing-page',
          ipAddress: await this.getClientIP(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Survey submission failed:', error);
      throw error;
    }
  }

  private static async getClientIP(): Promise<string> {
    try {
      // Try to get IP from a public service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }
}

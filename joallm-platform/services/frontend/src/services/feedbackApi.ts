import { API_ENDPOINTS } from '../config/api';
import { apiClient } from '../utils/api-client';

export type FeedbackRating = 'thumbs_up' | 'thumbs_down';

export interface MessageFeedbackPayload {
  rating: FeedbackRating;
}

export interface MessageFeedback {
  messageId: string;
  rating: FeedbackRating | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TrainingConsent {
  consentGiven: boolean;
  givenAt?: string | null;
  updatedAt?: string | null;
}

export const feedbackApi = {
  async submitFeedback(messageId: string, payload: MessageFeedbackPayload): Promise<MessageFeedback> {
    return apiClient.post<MessageFeedback>(API_ENDPOINTS.feedback.message(messageId), payload);
  },

  async getFeedback(messageId: string): Promise<MessageFeedback | null> {
    return apiClient.get<MessageFeedback | null>(API_ENDPOINTS.feedback.message(messageId), {
      showErrorToast: false,
      retries: 0,
    });
  },

  async deleteFeedback(messageId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.feedback.message(messageId), {
      showErrorToast: false,
      retries: 0,
    });
  },

  async getConsent(): Promise<TrainingConsent> {
    return apiClient.get<TrainingConsent>(API_ENDPOINTS.feedback.trainingConsent, {
      showErrorToast: false,
      retries: 0,
    });
  },

  async updateConsent(consentGiven: boolean): Promise<TrainingConsent> {
    return apiClient.patch<TrainingConsent>(API_ENDPOINTS.feedback.trainingConsent, { consentGiven });
  },
};

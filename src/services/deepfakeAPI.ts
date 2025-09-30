// Frontend service for communicating with deepfake detection API

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface DeepfakeMedia {
  id: number;
  media_type: 'photo' | 'video';
  media_url: string;
  thumbnail_url?: string;
  title?: string;
  description?: string;
  confidence_score: number;
  detection_method?: string;
  source_platform?: string;
  upload_date?: string;
  detected_date: string;
  file_size_mb?: number;
  duration_seconds?: number;
  resolution?: string;
  is_verified: boolean;
  tags?: string[];
  metadata?: any;
  rank?: number;
}

export interface DetectionStats {
  date: string;
  deepfake_photos_count: number;
  deepfake_videos_count: number;
  total_analyzed_photos: number;
  total_analyzed_videos: number;
  avg_confidence_score: number;
}

export interface RealTimeStats {
  date: string;
  photos_count: number;
  videos_count: number;
  avg_confidence: number;
  total_count: number;
}

export interface PlatformStats {
  source_platform: string;
  total_count: number;
  photos_count: number;
  videos_count: number;
  avg_confidence: number;
  max_confidence: number;
  verified_count: number;
}

export interface DeepfakeResponse {
  data: DeepfakeMedia[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface StatsResponse {
  historical_stats: DetectionStats[];
  realtime_stats: RealTimeStats[];
}

export interface RankingsResponse {
  rankings: DeepfakeMedia[];
  period: {
    startDate: string;
    endDate: string;
  };
  mediaType: string;
}

export interface PlatformResponse {
  platforms: PlatformStats[];
  period: {
    startDate: string;
    endDate: string;
  };
}

class DeepfakeAPIError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'DeepfakeAPIError';
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new DeepfakeAPIError(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof DeepfakeAPIError) {
      throw error;
    }

    // Network or other errors
    console.error('API request failed:', error);
    throw new DeepfakeAPIError(
      error instanceof Error ? error.message : 'Network request failed'
    );
  }
}

export const deepfakeAPI = {
  // Health check
  async healthCheck() {
    return apiRequest<{ status: string; database: string; timestamp: string }>('/health');
  },

  // Get deepfake media with filters
  async getDeepfakes(params: {
    startDate: string;
    endDate: string;
    mediaType?: 'photo' | 'video' | 'all';
    limit?: number;
    offset?: number;
    minConfidence?: number;
    platform?: string;
    verified?: boolean;
  }): Promise<DeepfakeResponse> {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    return apiRequest<DeepfakeResponse>(`/deepfakes?${queryParams}`);
  },

  // Get detection statistics
  async getStats(startDate: string, endDate: string): Promise<StatsResponse> {
    const queryParams = new URLSearchParams({
      startDate,
      endDate,
    });

    return apiRequest<StatsResponse>(`/stats?${queryParams}`);
  },

  // Get top deepfakes by confidence score
  async getRankings(params: {
    startDate: string;
    endDate: string;
    mediaType?: 'photo' | 'video' | 'all';
    limit?: number;
  }): Promise<RankingsResponse> {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    return apiRequest<RankingsResponse>(`/rankings?${queryParams}`);
  },

  // Get platform statistics
  async getPlatformStats(startDate: string, endDate: string): Promise<PlatformResponse> {
    const queryParams = new URLSearchParams({
      startDate,
      endDate,
    });

    return apiRequest<PlatformResponse>(`/platforms?${queryParams}`);
  },
};

export { DeepfakeAPIError };
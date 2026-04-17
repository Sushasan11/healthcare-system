export interface DoctorProfile {
  id: number;
  user_id: number;
  bio: string | null;
  qualifications: string | null;
  consultation_fee: number | null;
  avatar_url: string | null;
  rating: number | null;
  review_count: number;
}

export interface DoctorListItem {
  id: number;
  full_name: string;
  email: string;
  specialty: string | null;
  years_of_experience: number | null;
  profile: DoctorProfile | null;
}

export interface DoctorListResponse {
  items: DoctorListItem[];
  total: number;
  page: number;
  page_size: number;
}

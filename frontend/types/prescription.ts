export interface PrescriptionItemOut {
  id: number;
  medicine_name: string;
  dosage_amount: string;
  dosage_unit: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface PrescriptionOut {
  id: number;
  consultation_id: number;
  doctor_id: number;
  patient_id: number;
  status: string;
  issued_at: string;
  doctor_name: string | null;
  patient_name: string | null;
  diagnosis_snippet: string | null;
  item_count: number;
}

export interface PrescriptionDetailOut {
  id: number;
  consultation_id: number;
  doctor_id: number;
  patient_id: number;
  diagnosis: string;
  status: string;
  issued_at: string;
  doctor_name: string | null;
  doctor_specialty: string | null;
  doctor_license: string | null;
  patient_name: string | null;
  items: PrescriptionItemOut[];
}

export interface DrugOut {
  id: number;
  name: string;
  generic_name: string | null;
  form: string | null;
}

export interface PrescriptionItemCreate {
  medicine_name: string;
  dosage_amount: string;
  dosage_unit: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionCreatePayload {
  consultation_id: number;
  diagnosis: string;
  items: PrescriptionItemCreate[];
}

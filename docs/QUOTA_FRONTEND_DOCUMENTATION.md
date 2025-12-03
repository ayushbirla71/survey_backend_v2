# Survey Quota Management - Frontend Documentation

## Overview

This document provides comprehensive guidance for frontend developers to implement the Survey Quota Management feature. The quota system allows survey administrators to define demographic targets (age, gender, location, category) and track respondent completion rates.

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [User Interface Components](#2-user-interface-components)
3. [API Endpoints Reference](#3-api-endpoints-reference)
4. [Data Models & Types](#4-data-models--types)
5. [UI Flow & Wireframes](#5-ui-flow--wireframes)
6. [Form Validation Rules](#6-form-validation-rules)
7. [State Management](#7-state-management)
8. [Error Handling](#8-error-handling)
9. [Example Code Snippets](#9-example-code-snippets)

---

## 1. Feature Overview

### What is Quota Management?

Quota management allows survey creators to:

- Set target respondent counts for demographic groups
- Track real-time completion rates
- Automatically screen out respondents when quotas are full
- Integrate with third-party vendor panels

### Key Concepts

| Concept            | Description                                     |
| ------------------ | ----------------------------------------------- |
| **Total Target**   | Total number of survey completions needed       |
| **Age Quota**      | Target counts for specific age ranges           |
| **Gender Quota**   | Target counts for gender groups                 |
| **Location Quota** | Target counts for geographic regions            |
| **Category Quota** | Target counts for industry/category segments    |
| **Quota Type**     | COUNT (fixed number) or PERCENTAGE (% of total) |

### Vendor Integration URLs

| URL Type         | Purpose                                 |
| ---------------- | --------------------------------------- |
| `completed_url`  | Called when respondent completes survey |
| `terminated_url` | Called when respondent is screened out  |
| `quota_full_url` | Called when quota is already full       |

---

## 2. User Interface Components

### 2.1 Quota Configuration Panel

Location: Survey Settings → Quota Management Tab

```
┌─────────────────────────────────────────────────────────────┐
│  QUOTA CONFIGURATION                                        │
├─────────────────────────────────────────────────────────────┤
│  Total Target Respondents: [____1000____]                   │
│                                                             │
│  ☑ Enable Quota Management                                  │
├─────────────────────────────────────────────────────────────┤
│  VENDOR INTEGRATION URLS                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Completed URL:  [https://vendor.com/complete?rid=...]│   │
│  │ Terminated URL: [https://vendor.com/terminate?rid=..]│   │
│  │ Quota Full URL: [https://vendor.com/full?rid=...]    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Age Quota Section

```
┌─────────────────────────────────────────────────────────────┐
│  AGE QUOTAS                                    [+ Add Age]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Age Range: [18] - [24]  Type: [COUNT ▼]  Target: [200]│  │
│  │                                              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Age Range: [25] - [34]  Type: [COUNT ▼]  Target: [300]│  │
│  │                                              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Age Range: [35] - [44]  Type: [COUNT ▼]  Target: [250]│  │
│  │                                              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Age Range: [45] - [120] Type: [COUNT ▼]  Target: [250]│  │
│  │                                              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Total: 1000 / 1000 ✓                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Gender Quota Section

```
┌─────────────────────────────────────────────────────────────┐
│  GENDER QUOTAS                              [+ Add Gender]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Gender: [MALE ▼]    Type: [PERCENTAGE ▼]  Target: [50%]│ │
│  │                                              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Gender: [FEMALE ▼]  Type: [PERCENTAGE ▼]  Target: [50%]│ │
│  │                                              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Total: 100% / 100% ✓                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Location Quota Section

```
┌─────────────────────────────────────────────────────────────┐
│  LOCATION QUOTAS                          [+ Add Location]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Country: [USA ▼]  State: [California ▼]  City: [Any]  │  │
│  │ Type: [COUNT ▼]  Target: [300]              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Country: [USA ▼]  State: [New York ▼]    City: [Any]  │  │
│  │ Type: [COUNT ▼]  Target: [300]              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Category Quota Section

```
┌─────────────────────────────────────────────────────────────┐
│  CATEGORY QUOTAS                          [+ Add Category]  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Category: [Technology ▼]                              │  │
│  │ Type: [COUNT ▼]  Target: [400]              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Category: [Healthcare ▼]                              │  │
│  │ Type: [COUNT ▼]  Target: [300]              [🗑️]    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.6 Quota Status Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  QUOTA STATUS DASHBOARD                      [🔄 Refresh]   │
├─────────────────────────────────────────────────────────────┤
│  Overall Progress: ████████████░░░░░░░░ 65% (650/1000)     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AGE QUOTAS                                           │   │
│  │ 18-24: ████████████████░░░░ 80% (160/200)           │   │
│  │ 25-34: ██████████░░░░░░░░░░ 50% (150/300)           │   │
│  │ 35-44: ████████████████████ 100% (250/250) ✓ FULL   │   │
│  │ 45+:   ████████░░░░░░░░░░░░ 36% (90/250)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ GENDER QUOTAS                                        │   │
│  │ Male:   ██████████████░░░░░░ 70% (350/500)          │   │
│  │ Female: ████████████░░░░░░░░ 60% (300/500)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Statistics:                                                │
│  • Completed: 650  • Terminated: 45  • Quota Full: 12      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. API Endpoints Reference

### 3.1 Protected Endpoints (Require Authentication)

| Method | Endpoint                              | Description                      |
| ------ | ------------------------------------- | -------------------------------- |
| POST   | `/api/quota/surveys/:surveyId/quota`  | Create quota configuration       |
| GET    | `/api/quota/surveys/:surveyId/quota`  | Get quota configuration          |
| PUT    | `/api/quota/surveys/:surveyId/quota`  | Update quota configuration       |
| DELETE | `/api/quota/surveys/:surveyId/quota`  | Delete quota configuration       |
| GET    | `/api/quota/surveys/:surveyId/status` | Get quota status with fill rates |

### 3.2 Public Endpoints (Vendor Integration)

| Method | Endpoint                         | Description                   |
| ------ | -------------------------------- | ----------------------------- |
| POST   | `/api/quota/:surveyId/check`     | Check if respondent qualifies |
| POST   | `/api/quota/:surveyId/complete`  | Mark respondent as completed  |
| POST   | `/api/quota/:surveyId/terminate` | Mark respondent as terminated |

### 3.3 Supporting Endpoints

| Method | Endpoint                            | Description                           |
| ------ | ----------------------------------- | ------------------------------------- |
| GET    | `/api/categories/getSurveyCategory` | Get available categories for dropdown |

---

## 4. Data Models & Types

### 4.1 TypeScript Interfaces

```typescript
// Enums
type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
type QuotaType = "COUNT" | "PERCENTAGE";
type RespondentStatus = "QUALIFIED" | "COMPLETED" | "TERMINATED" | "QUOTA_FULL";

// Age Quota
interface AgeQuota {
  id?: string;
  min_age: number;
  max_age: number;
  quota_type: QuotaType;
  target_count?: number;
  target_percentage?: number;
  current_count?: number;
  is_active?: boolean;
}

// Gender Quota
interface GenderQuota {
  id?: string;
  gender: Gender;
  quota_type: QuotaType;
  target_count?: number;
  target_percentage?: number;
  current_count?: number;
  is_active?: boolean;
}

// Location Quota
interface LocationQuota {
  id?: string;
  country?: string;
  state?: string;
  city?: string;
  postal_code?: string;
  quota_type: QuotaType;
  target_count?: number;
  target_percentage?: number;
  current_count?: number;
  is_active?: boolean;
}

// Category Quota
interface CategoryQuota {
  id?: string;
  surveyCategoryId: string;
  surveyCategory?: {
    id: string;
    name: string;
  };
  quota_type: QuotaType;
  target_count?: number;
  target_percentage?: number;
  current_count?: number;
  is_active?: boolean;
}

// Main Quota Configuration
interface QuotaConfig {
  id?: string;
  surveyId: string;
  total_target: number;
  completed_url?: string;
  terminated_url?: string;
  quota_full_url?: string;
  total_completed?: number;
  total_terminated?: number;
  total_quota_full?: number;
  is_active?: boolean;
  age_quotas?: AgeQuota[];
  gender_quotas?: GenderQuota[];
  location_quotas?: LocationQuota[];
  category_quotas?: CategoryQuota[];
}

// Quota Status (with fill rates)
interface QuotaStatus {
  survey_id: string;
  total_target: number;
  total_completed: number;
  total_terminated: number;
  total_quota_full: number;
  overall_progress: number;
  is_active: boolean;
  age_quotas: (AgeQuota & QuotaFillStatus)[];
  gender_quotas: (GenderQuota & QuotaFillStatus)[];
  location_quotas: (LocationQuota & QuotaFillStatus)[];
  category_quotas: (CategoryQuota & QuotaFillStatus)[];
}

interface QuotaFillStatus {
  target: number;
  current: number;
  remaining: number;
  percentage_filled: number;
  is_full: boolean;
}
```

---

## 5. UI Flow & Wireframes

### 5.1 Quota Configuration Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Survey List    │────▶│  Survey Edit    │────▶│  Quota Tab      │
│                 │     │  Page           │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
               ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
               │  No Quota       │             │  Has Quota      │             │  Quota Status   │
               │  (Show Create)  │             │  (Show Edit)    │             │  Dashboard      │
               └────────┬────────┘             └────────┬────────┘             └─────────────────┘
                        │                               │
                        ▼                               ▼
               ┌─────────────────┐             ┌─────────────────┐
               │  Create Quota   │             │  Update Quota   │
               │  Form           │             │  Form           │
               └─────────────────┘             └─────────────────┘
```

### 5.2 User Journey

1. **Navigate to Survey** → User opens survey settings
2. **Select Quota Tab** → System checks if quota exists
3. **Configure Quotas** → User sets total target and demographic quotas
4. **Add Vendor URLs** → User configures callback URLs (optional)
5. **Save Configuration** → System validates and saves
6. **Monitor Status** → User views real-time fill rates

---

## 6. Form Validation Rules

### 6.1 Total Target

- Required field
- Must be positive integer (min: 1)
- Maximum: 1,000,000

### 6.2 Age Quotas

- `min_age`: 0-120, must be less than `max_age`
- `max_age`: 0-120, must be greater than `min_age`
- No overlapping age ranges allowed
- If COUNT type: sum must equal total_target
- If PERCENTAGE type: sum must equal 100%

### 6.3 Gender Quotas

- Valid values: MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
- No duplicate genders allowed
- If PERCENTAGE type: sum must equal 100%

### 6.4 Location Quotas

- At least one of: country, state, city, postal_code required
- No duplicate location combinations

### 6.5 Category Quotas

- `surveyCategoryId` must be valid UUID
- No duplicate categories allowed

### 6.6 Vendor URLs

- Must be valid URL format (https:// or http://)
- Supports placeholders: `{respondent_id}`, `{survey_id}`, `{status}`, `{timestamp}`

---

## 7. State Management

### 7.1 Recommended State Structure (Redux/Zustand)

```typescript
interface QuotaState {
  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Data
  quotaConfig: QuotaConfig | null;
  quotaStatus: QuotaStatus | null;
  categories: SurveyCategory[];

  // Form state
  formData: QuotaConfig;
  formErrors: Record<string, string>;
  isDirty: boolean;

  // Actions
  fetchQuotaConfig: (surveyId: string) => Promise<void>;
  fetchQuotaStatus: (surveyId: string) => Promise<void>;
  createQuotaConfig: (surveyId: string, data: QuotaConfig) => Promise<void>;
  updateQuotaConfig: (surveyId: string, data: QuotaConfig) => Promise<void>;
  deleteQuotaConfig: (surveyId: string) => Promise<void>;
  fetchCategories: () => Promise<void>;

  // Form actions
  setFormField: (field: string, value: any) => void;
  addAgeQuota: () => void;
  removeAgeQuota: (index: number) => void;
  addGenderQuota: () => void;
  removeGenderQuota: (index: number) => void;
  addLocationQuota: () => void;
  removeLocationQuota: (index: number) => void;
  addCategoryQuota: () => void;
  removeCategoryQuota: (index: number) => void;
  validateForm: () => boolean;
  resetForm: () => void;
}
```

---

## 8. Error Handling

### 8.1 API Error Responses

| Status Code | Error Type       | User Message                                       |
| ----------- | ---------------- | -------------------------------------------------- |
| 400         | Validation Error | "Please check your input and try again"            |
| 401         | Unauthorized     | "Please login to continue"                         |
| 403         | Forbidden        | "You don't have permission to perform this action" |
| 404         | Not Found        | "Quota configuration not found"                    |
| 409         | Conflict         | "Quota configuration already exists"               |
| 500         | Server Error     | "Something went wrong. Please try again later"     |

### 8.2 Validation Error Display

```typescript
// Example validation error response
{
  "message": "Quota validation failed",
  "errors": [
    {
      "field": "age_quotas",
      "message": "Age quota sum (800) does not match total target (1000)",
      "difference": 200
    },
    {
      "field": "gender_quotas",
      "message": "Percentage quotas must sum to 100% (current: 80%)",
      "currentTotal": 80
    }
  ]
}
```

---

## 9. Example Code Snippets

### 9.1 React Component - Quota Form

```tsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

const QuotaConfigForm: React.FC = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [formData, setFormData] = useState<QuotaConfig>({
    total_target: 1000,
    age_quotas: [],
    gender_quotas: [],
    location_quotas: [],
    category_quotas: [],
  });
  const [categories, setCategories] = useState<SurveyCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
    fetchExistingQuota();
  }, [surveyId]);

  const fetchCategories = async () => {
    const response = await fetch("/api/categories/getSurveyCategory", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setCategories(data.categories || []);
  };

  const fetchExistingQuota = async () => {
    try {
      const response = await fetch(`/api/quota/surveys/${surveyId}/quota`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFormData(data.quota);
      }
    } catch (error) {
      // No existing quota - show create form
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/quota/surveys/${surveyId}/quota`, {
        method: formData.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Handle validation errors
        if (errorData.errors) {
          const errorMap: Record<string, string> = {};
          errorData.errors.forEach((err: any) => {
            errorMap[err.field] = err.message;
          });
          setErrors(errorMap);
        }
        return;
      }

      // Success - show notification
      alert("Quota configuration saved successfully!");
    } catch (error) {
      console.error("Error saving quota:", error);
    } finally {
      setLoading(false);
    }
  };

  // ... render form components
};
```

### 9.2 API Service Functions

```typescript
// quotaService.ts
const API_BASE = "/api/quota";

export const quotaService = {
  // Create quota configuration
  async createQuota(surveyId: string, data: QuotaConfig, token: string) {
    const response = await fetch(`${API_BASE}/surveys/${surveyId}/quota`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  // Get quota configuration
  async getQuota(surveyId: string, token: string) {
    const response = await fetch(`${API_BASE}/surveys/${surveyId}/quota`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  },

  // Update quota configuration
  async updateQuota(
    surveyId: string,
    data: Partial<QuotaConfig>,
    token: string
  ) {
    const response = await fetch(`${API_BASE}/surveys/${surveyId}/quota`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  // Delete quota configuration
  async deleteQuota(surveyId: string, token: string) {
    const response = await fetch(`${API_BASE}/surveys/${surveyId}/quota`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  },

  // Get quota status with fill rates
  async getQuotaStatus(surveyId: string, token: string) {
    const response = await fetch(`${API_BASE}/surveys/${surveyId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.json();
  },
};
```

### 9.3 Progress Bar Component

```tsx
interface ProgressBarProps {
  current: number;
  target: number;
  label: string;
  showPercentage?: boolean;
}

const QuotaProgressBar: React.FC<ProgressBarProps> = ({
  current,
  target,
  label,
  showPercentage = true,
}) => {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isFull = current >= target;

  return (
    <div className="quota-progress">
      <div className="quota-progress-label">
        <span>{label}</span>
        <span>
          {current}/{target}
          {showPercentage && ` (${percentage.toFixed(1)}%)`}
          {isFull && <span className="badge-full">FULL</span>}
        </span>
      </div>
      <div className="quota-progress-bar">
        <div
          className={`quota-progress-fill ${isFull ? "full" : ""}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
```

---

## 10. Best Practices

### 10.1 Performance

- Use debouncing for form inputs
- Implement optimistic updates for better UX
- Cache quota status and refresh periodically (every 30s)

### 10.2 Accessibility

- Use proper ARIA labels for form fields
- Ensure keyboard navigation works
- Provide clear error messages

### 10.3 Mobile Responsiveness

- Stack quota sections vertically on mobile
- Use collapsible sections for quota groups
- Ensure touch targets are at least 44x44px

---

## 11. Testing Checklist

- [ ] Create quota with all quota types
- [ ] Update existing quota configuration
- [ ] Delete quota configuration
- [ ] Validate form errors display correctly
- [ ] Test percentage quota validation (must sum to 100%)
- [ ] Test count quota validation (must sum to total)
- [ ] Verify quota status dashboard updates
- [ ] Test vendor URL placeholder replacement
- [ ] Verify progress bars display correctly
- [ ] Test mobile responsiveness

---

## 12. Support

For questions or issues, contact the backend team or refer to:

- Backend Documentation: `docs/QUOTA_FEATURE_DOCUMENTATION.md`
- Postman Collection: `postman/Quota_API_Collection.postman_collection.json`
- API Environment: `postman/Quota_API_Environment.postman_environment.json`

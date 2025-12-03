# Survey Quota Management System - Technical Documentation

## Overview

The Quota Management System allows survey administrators to define and control the demographic distribution of survey respondents. This feature enables precise targeting by setting limits on age groups, genders, locations, and industries.

---

## Table of Contents

1. [Database Schema Changes](#1-database-schema-changes)
2. [Enums](#2-enums)
3. [Data Models](#3-data-models)
4. [Validation Logic](#4-validation-logic)
5. [API Endpoints](#5-api-endpoints)
6. [Vendor Integration Flow](#6-vendor-integration-flow)
7. [Implementation Flow](#7-implementation-flow)
8. [Example Payloads](#8-example-payloads)

---

## 1. Database Schema Changes

Add the following to your `prisma/schema.prisma`:

### New Enums

```prisma
enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY
}

enum QuotaType {
  COUNT       // Fixed number (e.g., 100 respondents)
  PERCENTAGE  // Percentage of total (e.g., 40%)
}

enum RespondentStatus {
  QUALIFIED     // User qualifies for the survey
  COMPLETED     // User completed the survey
  TERMINATED    // User terminated/screened out
  QUOTA_FULL    // User's quota group is full
}
```

### New Models

```prisma
model SurveyQuota {
  id                    String    @id @default(uuid())
  surveyId              String    @unique
  survey                Survey    @relation(fields: [surveyId], references: [id])

  // Total target respondents
  total_target          Int       // Total number of qualified respondents wanted

  // Redirect URLs for vendor integration
  completed_url         String?   // URL to call when user completes survey
  terminated_url        String?   // URL to call when user is terminated/screened out
  quota_full_url        String?   // URL to call when quota is full

  // Tracking
  total_completed       Int       @default(0)
  total_terminated      Int       @default(0)
  total_quota_full      Int       @default(0)

  is_active             Boolean   @default(true)
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  // Quota groups
  age_quotas            AgeQuota[]
  gender_quotas         GenderQuota[]
  location_quotas       LocationQuota[]
  category_quotas       CategoryQuota[]   // Uses existing SurveyCategory
  respondents           QuotaRespondent[]
}

model AgeQuota {
  id                String      @id @default(uuid())
  surveyQuotaId     String
  surveyQuota       SurveyQuota @relation(fields: [surveyQuotaId], references: [id], onDelete: Cascade)

  min_age           Int
  max_age           Int
  quota_type        QuotaType   @default(COUNT)
  target_count      Int?        // If COUNT type
  target_percentage Float?      // If PERCENTAGE type (0-100)
  current_count     Int         @default(0)
  is_active         Boolean     @default(true)

  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt

  @@unique([surveyQuotaId, min_age, max_age])
}

model GenderQuota {
  id                String      @id @default(uuid())
  surveyQuotaId     String
  surveyQuota       SurveyQuota @relation(fields: [surveyQuotaId], references: [id], onDelete: Cascade)

  gender            Gender
  quota_type        QuotaType   @default(COUNT)
  target_count      Int?
  target_percentage Float?
  current_count     Int         @default(0)
  is_active         Boolean     @default(true)

  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt

  @@unique([surveyQuotaId, gender])
}

model LocationQuota {
  id                String      @id @default(uuid())
  surveyQuotaId     String
  surveyQuota       SurveyQuota @relation(fields: [surveyQuotaId], references: [id], onDelete: Cascade)

  country           String?
  state             String?
  city              String?
  postal_code       String?
  quota_type        QuotaType   @default(COUNT)
  target_count      Int?
  target_percentage Float?
  current_count     Int         @default(0)
  is_active         Boolean     @default(true)

  created_at        DateTime    @default(now())
  updated_at        DateTime    @updatedAt

  @@index([surveyQuotaId, country, state, city])
}

// Category/Industry Quota - Uses existing SurveyCategory model
model CategoryQuota {
  id                String         @id @default(uuid())
  surveyQuotaId     String
  surveyQuota       SurveyQuota    @relation(fields: [surveyQuotaId], references: [id], onDelete: Cascade)

  surveyCategoryId  String
  surveyCategory    SurveyCategory @relation(fields: [surveyCategoryId], references: [id])
  quota_type        QuotaType      @default(COUNT)
  target_count      Int?
  target_percentage Float?
  current_count     Int            @default(0)
  is_active         Boolean        @default(true)

  created_at        DateTime       @default(now())
  updated_at        DateTime       @updatedAt

  @@unique([surveyQuotaId, surveyCategoryId])
}

// Update existing SurveyCategory model to add relation
model SurveyCategory {
  id              String          @id @default(uuid())
  name            String          @unique
  surveys         Survey[]
  category_quotas CategoryQuota[]  // Add this relation
}

// Track individual respondent quota status
model QuotaRespondent {
  id                String           @id @default(uuid())
  surveyQuotaId     String
  surveyQuota       SurveyQuota      @relation(fields: [surveyQuotaId], references: [id])

  // Respondent info (from vendor)
  vendor_respondent_id  String?      // Vendor's unique ID for this respondent
  age                   Int?
  gender                Gender?
  country               String?
  state                 String?
  city                  String?
  surveyCategoryId      String?      // Uses existing SurveyCategory

  status                RespondentStatus @default(QUALIFIED)
  redirect_url_called   String?          // Which URL was called
  redirect_called_at    DateTime?

  // Link to response if completed
  responseId            String?   @unique

  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  @@index([surveyQuotaId, status])
  @@index([vendor_respondent_id])
}
```

### Update Survey Model

Add the relation to the existing Survey model:

```prisma
model Survey {
  // ... existing fields ...

  // Add this relation
  quota                 SurveyQuota?
}
```

---

## 2. Validation Logic

### Total Quota Validation

The sum of all quotas (when using COUNT type) must equal the total_target:

```javascript
// Validation function for quota creation/update
function validateQuotaConfiguration(quotaConfig) {
  const {
    total_target,
    age_quotas,
    gender_quotas,
    location_quotas,
    category_quotas, // Changed from industry_quotas
  } = quotaConfig;

  const errors = [];

  // Validate age quotas
  if (age_quotas && age_quotas.length > 0) {
    const totalAgeQuota = calculateTotalQuota(age_quotas, total_target);
    if (totalAgeQuota !== total_target) {
      errors.push({
        field: "age_quotas",
        message: `Age quota sum (${totalAgeQuota}) does not match total target (${total_target})`,
        difference: total_target - totalAgeQuota,
      });
    }
  }

  // Validate gender quotas
  if (gender_quotas && gender_quotas.length > 0) {
    const totalGenderQuota = calculateTotalQuota(gender_quotas, total_target);
    if (totalGenderQuota !== total_target) {
      errors.push({
        field: "gender_quotas",
        message: `Gender quota sum (${totalGenderQuota}) does not match total target (${total_target})`,
        difference: total_target - totalGenderQuota,
      });
    }
  }

  // Validate location quotas (if provided)
  if (location_quotas && location_quotas.length > 0) {
    const totalLocationQuota = calculateTotalQuota(
      location_quotas,
      total_target
    );
    if (totalLocationQuota !== total_target) {
      errors.push({
        field: "location_quotas",
        message: `Location quota sum (${totalLocationQuota}) does not match total target (${total_target})`,
        difference: total_target - totalLocationQuota,
      });
    }
  }

  // Validate category quotas (if provided) - Uses SurveyCategory
  if (category_quotas && category_quotas.length > 0) {
    const totalCategoryQuota = calculateTotalQuota(
      category_quotas,
      total_target
    );
    if (totalCategoryQuota !== total_target) {
      errors.push({
        field: "category_quotas",
        message: `Category quota sum (${totalCategoryQuota}) does not match total target (${total_target})`,
        difference: total_target - totalCategoryQuota,
      });
    }
  }

  // Validate percentage quotas sum to 100%
  validatePercentageQuotas(age_quotas, "age_quotas", errors);
  validatePercentageQuotas(gender_quotas, "gender_quotas", errors);
  validatePercentageQuotas(location_quotas, "location_quotas", errors);
  validatePercentageQuotas(category_quotas, "category_quotas", errors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Calculate total from count or percentage
function calculateTotalQuota(quotas, total_target) {
  return quotas.reduce((sum, quota) => {
    if (quota.quota_type === "COUNT") {
      return sum + (quota.target_count || 0);
    } else if (quota.quota_type === "PERCENTAGE") {
      return sum + Math.round((quota.target_percentage / 100) * total_target);
    }
    return sum;
  }, 0);
}

// Validate percentage quotas sum to 100%
function validatePercentageQuotas(quotas, fieldName, errors) {
  if (!quotas) return;

  const percentageQuotas = quotas.filter((q) => q.quota_type === "PERCENTAGE");
  if (percentageQuotas.length > 0) {
    const totalPercentage = percentageQuotas.reduce(
      (sum, q) => sum + (q.target_percentage || 0),
      0
    );
    if (Math.abs(totalPercentage - 100) > 0.01) {
      // Allow small floating point errors
      errors.push({
        field: fieldName,
        message: `Percentage quotas must sum to 100% (current: ${totalPercentage}%)`,
        currentTotal: totalPercentage,
      });
    }
  }
}
```

---

## 3. API Endpoints

### Quota Management Endpoints

| Method | Endpoint                              | Description                |
| ------ | ------------------------------------- | -------------------------- |
| POST   | `/api/surveys/:surveyId/quota`        | Create quota configuration |
| GET    | `/api/surveys/:surveyId/quota`        | Get quota configuration    |
| PUT    | `/api/surveys/:surveyId/quota`        | Update quota configuration |
| DELETE | `/api/surveys/:surveyId/quota`        | Delete quota configuration |
| GET    | `/api/surveys/:surveyId/quota/status` | Get quota fill status      |

### Respondent Flow Endpoints (for vendors)

| Method | Endpoint                         | Description                   |
| ------ | -------------------------------- | ----------------------------- |
| POST   | `/api/quota/:surveyId/check`     | Check if respondent qualifies |
| POST   | `/api/quota/:surveyId/complete`  | Mark respondent as completed  |
| POST   | `/api/quota/:surveyId/terminate` | Mark respondent as terminated |

### Master Data Endpoints

| Method | Endpoint                 | Description                                |
| ------ | ------------------------ | ------------------------------------------ |
| GET    | `/api/survey-categories` | Get list of categories (existing endpoint) |

---

## 4. Vendor Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VENDOR INTEGRATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────┐                  ┌──────────────┐                ┌─────────┐
     │  VENDOR  │                  │ SURVEY API   │                │ SURVEY  │
     └────┬─────┘                  └──────┬───────┘                └────┬────┘
          │                               │                             │
          │ 1. Send respondent data       │                             │
          │ (age, gender, location, etc.) │                             │
          ├──────────────────────────────►│                             │
          │                               │                             │
          │                               │ 2. Check quotas             │
          │                               │    - Age quota full?        │
          │                               │    - Gender quota full?     │
          │                               │    - Location quota full?   │
          │                               │    - Category quota full?   │
          │                               │                             │
          │                    ┌──────────┴──────────┐                  │
          │                    │                     │                  │
          │              QUALIFIED           QUOTA FULL                 │
          │                    │                     │                  │
          │                    ▼                     ▼                  │
          │           3a. Return survey      3b. Redirect to           │
          │               link/token         quota_full_url            │
          │◄───────────────────┤                     │                  │
          │                    │                     │                  │
          │ 4. User takes      │                     │                  │
          │    survey          │                     │                  │
          ├────────────────────┼─────────────────────┼─────────────────►│
          │                    │                     │                  │
          │                    │                     │      5. Survey   │
          │                    │                     │         Result   │
          │                    │                     │                  │
          │           ┌────────┴────────┐            │                  │
          │           │                 │            │                  │
          │      COMPLETED         TERMINATED        │                  │
          │           │                 │            │                  │
          │           ▼                 ▼            │                  │
          │    6a. Call           6b. Call          │                  │
          │    completed_url      terminated_url    │                  │
          │◄──────────┤                 │           │                  │
          │           │                 ├───────────┘                  │
          │           │                 │                              │
          │    7. Update quota    7. Log termination                   │
          │       counts              reason                           │
          │           │                 │                              │
          └───────────┴─────────────────┘                              │
```

---

## 5. Example API Payloads

### Create Quota Configuration

**POST** `/api/surveys/:surveyId/quota`

```json
{
  "total_target": 1000,
  "completed_url": "https://vendor.com/callback/complete?rid={respondent_id}",
  "terminated_url": "https://vendor.com/callback/terminate?rid={respondent_id}",
  "quota_full_url": "https://vendor.com/callback/quota-full?rid={respondent_id}",

  "age_quotas": [
    {
      "min_age": 18,
      "max_age": 24,
      "quota_type": "PERCENTAGE",
      "target_percentage": 20
    },
    {
      "min_age": 25,
      "max_age": 34,
      "quota_type": "PERCENTAGE",
      "target_percentage": 30
    },
    {
      "min_age": 35,
      "max_age": 44,
      "quota_type": "PERCENTAGE",
      "target_percentage": 25
    },
    {
      "min_age": 45,
      "max_age": 65,
      "quota_type": "PERCENTAGE",
      "target_percentage": 25
    }
  ],

  "gender_quotas": [
    {
      "gender": "MALE",
      "quota_type": "PERCENTAGE",
      "target_percentage": 40
    },
    {
      "gender": "FEMALE",
      "quota_type": "PERCENTAGE",
      "target_percentage": 40
    },
    {
      "gender": "OTHER",
      "quota_type": "PERCENTAGE",
      "target_percentage": 20
    }
  ],

  "location_quotas": [
    {
      "country": "USA",
      "state": "California",
      "quota_type": "COUNT",
      "target_count": 300
    },
    {
      "country": "USA",
      "state": "New York",
      "quota_type": "COUNT",
      "target_count": 300
    },
    {
      "country": "USA",
      "state": "Texas",
      "quota_type": "COUNT",
      "target_count": 400
    }
  ],

  "category_quotas": [
    {
      "surveyCategoryId": "category-uuid-1",
      "quota_type": "COUNT",
      "target_count": 250
    },
    {
      "surveyCategoryId": "category-uuid-2",
      "quota_type": "COUNT",
      "target_count": 250
    },
    {
      "surveyCategoryId": "category-uuid-3",
      "quota_type": "COUNT",
      "target_count": 500
    }
  ]
}
```

### Check Respondent Qualification

**POST** `/api/quota/:surveyId/check`

```json
{
  "vendor_respondent_id": "vendor-resp-12345",
  "age": 28,
  "gender": "FEMALE",
  "country": "USA",
  "state": "California",
  "city": "Los Angeles",
  "surveyCategoryId": "category-uuid-1"
}
```

**Response (Qualified):**

```json
{
  "status": "QUALIFIED",
  "survey_link": "https://survey.example.com/s/abc123?rid=respondent-uuid",
  "respondent_id": "respondent-uuid",
  "message": "Respondent qualifies for the survey"
}
```

**Response (Quota Full):**

```json
{
  "status": "QUOTA_FULL",
  "redirect_url": "https://vendor.com/callback/quota-full?rid=vendor-resp-12345",
  "quota_full_for": ["gender", "location"],
  "message": "Quota is full for this demographic"
}
```

### Mark Respondent Completed

**POST** `/api/quota/:surveyId/complete`

```json
{
  "respondent_id": "respondent-uuid",
  "response_id": "survey-response-uuid"
}
```

**Response:**

```json
{
  "status": "COMPLETED",
  "redirect_url": "https://vendor.com/callback/complete?rid=vendor-resp-12345",
  "message": "Respondent marked as completed"
}
```

### Get Quota Status

**GET** `/api/surveys/:surveyId/quota/status`

**Response:**

```json
{
  "survey_id": "survey-uuid",
  "total_target": 1000,
  "total_completed": 450,
  "total_terminated": 120,
  "total_quota_full": 80,
  "completion_percentage": 45.0,
  "is_active": true,

  "age_quotas": [
    {
      "min_age": 18,
      "max_age": 24,
      "target": 200,
      "current": 85,
      "remaining": 115,
      "percentage_filled": 42.5,
      "is_full": false
    },
    {
      "min_age": 25,
      "max_age": 34,
      "target": 300,
      "current": 300,
      "remaining": 0,
      "percentage_filled": 100,
      "is_full": true
    }
  ],

  "gender_quotas": [
    {
      "gender": "MALE",
      "target": 400,
      "current": 180,
      "remaining": 220,
      "percentage_filled": 45.0,
      "is_full": false
    },
    {
      "gender": "FEMALE",
      "target": 400,
      "current": 200,
      "remaining": 200,
      "percentage_filled": 50.0,
      "is_full": false
    },
    {
      "gender": "OTHER",
      "target": 200,
      "current": 70,
      "remaining": 130,
      "percentage_filled": 35.0,
      "is_full": false
    }
  ],

  "location_quotas": [
    {
      "country": "USA",
      "state": "California",
      "target": 300,
      "current": 150,
      "remaining": 150,
      "percentage_filled": 50.0,
      "is_full": false
    }
  ],

  "category_quotas": [
    {
      "category_name": "Technology",
      "target": 250,
      "current": 100,
      "remaining": 150,
      "percentage_filled": 40.0,
      "is_full": false
    }
  ]
}
```

---

## 6. Implementation Flow

### Step 1: Database Migration

1. Add the new enums and models to `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add_quota_tables`
3. Run `npx prisma generate` to update the Prisma client

### Step 2: Create Validation Schemas

Create validation schemas in `src/validations/quotaValidation.js`:

```javascript
import Joi from "joi";

export const quotaConfigValidation = Joi.object({
  total_target: Joi.number().integer().min(1).required(),
  completed_url: Joi.string().uri().optional(),
  terminated_url: Joi.string().uri().optional(),
  quota_full_url: Joi.string().uri().optional(),

  age_quotas: Joi.array()
    .items(
      Joi.object({
        min_age: Joi.number().integer().min(0).max(120).required(),
        max_age: Joi.number()
          .integer()
          .min(Joi.ref("min_age"))
          .max(120)
          .required(),
        quota_type: Joi.string().valid("COUNT", "PERCENTAGE").default("COUNT"),
        target_count: Joi.number().integer().min(1).when("quota_type", {
          is: "COUNT",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
        target_percentage: Joi.number().min(0.01).max(100).when("quota_type", {
          is: "PERCENTAGE",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      })
    )
    .optional(),

  gender_quotas: Joi.array()
    .items(
      Joi.object({
        gender: Joi.string()
          .valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY")
          .required(),
        quota_type: Joi.string().valid("COUNT", "PERCENTAGE").default("COUNT"),
        target_count: Joi.number().integer().min(1).when("quota_type", {
          is: "COUNT",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
        target_percentage: Joi.number().min(0.01).max(100).when("quota_type", {
          is: "PERCENTAGE",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      })
    )
    .optional(),

  location_quotas: Joi.array()
    .items(
      Joi.object({
        country: Joi.string().optional(),
        state: Joi.string().optional(),
        city: Joi.string().optional(),
        postal_code: Joi.string().optional(),
        quota_type: Joi.string().valid("COUNT", "PERCENTAGE").default("COUNT"),
        target_count: Joi.number().integer().min(1).when("quota_type", {
          is: "COUNT",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
        target_percentage: Joi.number().min(0.01).max(100).when("quota_type", {
          is: "PERCENTAGE",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      }).or("country", "state", "city", "postal_code")
    )
    .optional(),

  category_quotas: Joi.array()
    .items(
      Joi.object({
        surveyCategoryId: Joi.string().uuid().required(),
        quota_type: Joi.string().valid("COUNT", "PERCENTAGE").default("COUNT"),
        target_count: Joi.number().integer().min(1).when("quota_type", {
          is: "COUNT",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
        target_percentage: Joi.number().min(0.01).max(100).when("quota_type", {
          is: "PERCENTAGE",
          then: Joi.required(),
          otherwise: Joi.forbidden(),
        }),
      })
    )
    .optional(),
});

export const checkRespondentValidation = Joi.object({
  vendor_respondent_id: Joi.string().required(),
  age: Joi.number().integer().min(0).max(120).optional(),
  gender: Joi.string()
    .valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY")
    .optional(),
  country: Joi.string().optional(),
  state: Joi.string().optional(),
  city: Joi.string().optional(),
  surveyCategoryId: Joi.string().uuid().optional(),
});
```

### Step 3: Create Controller Functions

Create `src/controllers/quotaController.js` with the following functions:

1. `createQuotaConfig` - Create quota configuration for a survey
2. `getQuotaConfig` - Get quota configuration
3. `updateQuotaConfig` - Update quota configuration
4. `deleteQuotaConfig` - Delete quota configuration
5. `getQuotaStatus` - Get real-time quota fill status
6. `checkRespondentQuota` - Check if respondent qualifies
7. `markRespondentCompleted` - Mark respondent as completed and call callback
8. `markRespondentTerminated` - Mark respondent as terminated and call callback

### Step 4: Create Routes

Create `src/routes/quotaRoutes.js`:

```javascript
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import validateRequest from "../middleware/validateRequest.js";
import {
  quotaConfigValidation,
  checkRespondentValidation,
} from "../validations/quotaValidation.js";
import {
  createQuotaConfig,
  getQuotaConfig,
  updateQuotaConfig,
  deleteQuotaConfig,
  getQuotaStatus,
  checkRespondentQuota,
  markRespondentCompleted,
  markRespondentTerminated,
} from "../controllers/quotaController.js";

const router = express.Router();

// Survey quota management (protected)
router.post(
  "/surveys/:surveyId/quota",
  protect,
  validateRequest(quotaConfigValidation),
  createQuotaConfig
);
router.get("/surveys/:surveyId/quota", protect, getQuotaConfig);
router.put(
  "/surveys/:surveyId/quota",
  protect,
  validateRequest(quotaConfigValidation),
  updateQuotaConfig
);
router.delete("/surveys/:surveyId/quota", protect, deleteQuotaConfig);
router.get("/surveys/:surveyId/quota/status", protect, getQuotaStatus);

// Vendor integration endpoints (API key auth recommended)
router.post(
  "/:surveyId/check",
  validateRequest(checkRespondentValidation),
  checkRespondentQuota
);
router.post("/:surveyId/complete", markRespondentCompleted);
router.post("/:surveyId/terminate", markRespondentTerminated);

export default router;
```

### Step 5: Register Routes

Add to `src/app.js`:

```javascript
import quotaRoutes from "./routes/quotaRoutes.js";

// Add after other routes
app.use("/api/quota", quotaRoutes);
```

### Step 6: Use Existing SurveyCategory

No seeding required! The quota system uses the existing `SurveyCategory` model that is already populated in your database. When configuring category quotas, fetch the available categories from:

```
GET /api/survey-categories
```

And use the returned category IDs when creating quota configurations.

---

## 7. Quota Checking Algorithm

```javascript
async function checkQuotaAvailability(surveyQuotaId, respondentData) {
  const { age, gender, country, state, city, surveyCategoryId } =
    respondentData;

  const quotaFullFor = [];

  // Check Age Quota
  if (age !== undefined) {
    const ageQuota = await prisma.ageQuota.findFirst({
      where: {
        surveyQuotaId,
        min_age: { lte: age },
        max_age: { gte: age },
        is_active: true,
      },
    });

    if (ageQuota) {
      const targetCount =
        ageQuota.quota_type === "COUNT"
          ? ageQuota.target_count
          : Math.round((ageQuota.target_percentage / 100) * totalTarget);

      if (ageQuota.current_count >= targetCount) {
        quotaFullFor.push("age");
      }
    }
  }

  // Check Gender Quota
  if (gender) {
    const genderQuota = await prisma.genderQuota.findFirst({
      where: {
        surveyQuotaId,
        gender,
        is_active: true,
      },
    });

    if (genderQuota) {
      const targetCount =
        genderQuota.quota_type === "COUNT"
          ? genderQuota.target_count
          : Math.round((genderQuota.target_percentage / 100) * totalTarget);

      if (genderQuota.current_count >= targetCount) {
        quotaFullFor.push("gender");
      }
    }
  }

  // Check Location Quota
  if (country || state || city) {
    const locationQuota = await prisma.locationQuota.findFirst({
      where: {
        surveyQuotaId,
        country: country || undefined,
        state: state || undefined,
        city: city || undefined,
        is_active: true,
      },
    });

    if (locationQuota) {
      const targetCount =
        locationQuota.quota_type === "COUNT"
          ? locationQuota.target_count
          : Math.round((locationQuota.target_percentage / 100) * totalTarget);

      if (locationQuota.current_count >= targetCount) {
        quotaFullFor.push("location");
      }
    }
  }

  // Check Category Quota (uses SurveyCategory)
  if (surveyCategoryId) {
    const categoryQuota = await prisma.categoryQuota.findFirst({
      where: {
        surveyQuotaId,
        surveyCategoryId: surveyCategoryId,
        is_active: true,
      },
    });

    if (categoryQuota) {
      const targetCount =
        categoryQuota.quota_type === "COUNT"
          ? categoryQuota.target_count
          : Math.round((categoryQuota.target_percentage / 100) * totalTarget);

      if (categoryQuota.current_count >= targetCount) {
        quotaFullFor.push("category");
      }
    }
  }

  return {
    isQualified: quotaFullFor.length === 0,
    quotaFullFor,
  };
}
```

---

## 8. Callback URL Handling

When calling vendor callback URLs, replace placeholders with actual values:

```javascript
function processCallbackUrl(url, respondentData) {
  if (!url) return null;

  return url
    .replace("{respondent_id}", respondentData.vendor_respondent_id || "")
    .replace("{survey_id}", respondentData.surveyId || "")
    .replace("{status}", respondentData.status || "")
    .replace("{timestamp}", new Date().toISOString());
}

async function callVendorCallback(url, method = "GET") {
  try {
    const response = await fetch(url, { method });
    return {
      success: response.ok,
      status: response.status,
    };
  } catch (error) {
    console.error("Vendor callback error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

---

## 9. Important Considerations

### Concurrency Handling

Use database transactions to prevent race conditions when updating quota counts:

```javascript
await prisma.$transaction(async (tx) => {
  // Lock and check quota
  const quota = await tx.genderQuota.findUnique({
    where: { id: quotaId },
  });

  if (quota.current_count >= quota.target_count) {
    throw new Error("Quota full");
  }

  // Increment quota
  await tx.genderQuota.update({
    where: { id: quotaId },
    data: { current_count: { increment: 1 } },
  });
});
```

### Error Handling

- Always validate quota configuration before saving
- Handle edge cases like respondent not matching any quota group
- Log all vendor callback failures for debugging
- Implement retry logic for failed callbacks

### Security

- Use API keys for vendor integration endpoints
- Validate survey ownership for quota management
- Rate limit the check endpoint to prevent abuse
- Sanitize callback URLs to prevent SSRF attacks

---

## 10. Files to Create/Modify

| File                                 | Action | Description                |
| ------------------------------------ | ------ | -------------------------- |
| `prisma/schema.prisma`               | Modify | Add quota enums and models |
| `src/validations/quotaValidation.js` | Create | Validation schemas         |
| `src/controllers/quotaController.js` | Create | Controller functions       |
| `src/routes/quotaRoutes.js`          | Create | Route definitions          |
| `src/utils/quotaUtils.js`            | Create | Helper functions           |
| `src/app.js`                         | Modify | Register quota routes      |

---

## Summary

This quota management system provides:

1. ✅ **Age Group Quotas** - Define min/max age ranges with counts or percentages
2. ✅ **Gender Quotas** - Define gender distribution
3. ✅ **Location Quotas** - Define geographic targeting
4. ✅ **Category Quotas** - Select from existing SurveyCategory list
5. ✅ **Total Target Validation** - Ensure quotas sum to total
6. ✅ **Percentage Support** - Use percentages instead of fixed counts
7. ✅ **Vendor Integration** - Callback URLs for completed/terminated/quota-full
8. ✅ **Real-time Status** - Track quota fill progress
9. ✅ **Respondent Tracking** - Track individual respondent status

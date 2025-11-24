# Multi-Choice Grid and Checkbox Grid Options Fix

## Issues Identified and Fixed

### Problem Summary
The multi-choice grid and checkbox grid question types were not properly saving or retrieving their row and column options from the database.

### Root Causes

1. **In `createQuestionsWithOptions` function (lines 3-148)**:
   - The function was checking `if (options && options.length > 0)` before processing any question type
   - For grid types, the data comes in `rowOptions` and `columnOptions` arrays, NOT in the `options` array
   - This meant the grid case inside the switch statement never executed because the outer condition failed

2. **In `updateQuestion` function (lines 341-524)**:
   - Same issue - only processed options if `options.length > 0`
   - Grid types need to check `rowOptions` and `columnOptions` instead

3. **In `createQuestion` response (lines 197-212)**:
   - The response didn't include `rowOptions` and `columnOptions` in the query
   - Frontend couldn't see the saved grid options

4. **In `updateQuestion` response (lines 501-511)**:
   - Same issue - missing `rowOptions` and `columnOptions` in the final query

5. **In `getQuestions` function (lines 251-323)**:
   - Had unnecessary restructuring logic that could cause issues
   - Simplified to return the natural structure with rowOptions and columnOptions

## Changes Made

### 1. Fixed `createQuestionsWithOptions` Function
**File**: `src/controllers/questionController.js`

**Changes**:
- Removed the outer `if (options && options.length > 0)` condition
- Moved category type check outside the condition
- Added individual checks for each question type
- For grid types, now properly checks `rowOptions` and `columnOptions` arrays
- Added detailed logging for debugging grid operations

**Key Code Change**:
```javascript
// Before: Only processed if options.length > 0
if (options && options.length > 0) {
  // ... all switch cases
}

// After: Process based on category type, check arrays individually
switch (categoryType) {
  case "multi-choice grid":
  case "checkbox grid":
    if (rowOptions && rowOptions.length > 0) {
      // Process row options
    }
    if (columnOptions && columnOptions.length > 0) {
      // Process column options
    }
    break;
  // ... other cases
}
```

### 2. Fixed `createQuestion` Response
**File**: `src/controllers/questionController.js` (lines 197-212)

**Changes**:
- Added `rowOptions: true` to the include clause
- Added `columnOptions: true` to the include clause
- Added `mediaAsset: true` and `category: true` for completeness

### 3. Fixed `updateQuestion` Function
**File**: `src/controllers/questionController.js` (lines 343-524)

**Changes**:
- Restructured to check category type first
- Added individual checks for each question type's options
- For grid types, properly processes `rowOptions` and `columnOptions`
- Added detailed logging for debugging
- Fixed final response to include `rowOptions` and `columnOptions`

### 4. Simplified `getQuestions` Function
**File**: `src/controllers/questionController.js` (lines 251-323)

**Changes**:
- Removed unnecessary restructuring logic
- Returns natural structure with `rowOptions` and `columnOptions` directly accessible
- Frontend can now access grid options without special handling

## Database Schema (No Changes Needed)

The Prisma schema already supports grid options correctly:

```prisma
model Question {
  options        Option[] @relation(name: "QuestionOptions")
  rowOptions     Option[] @relation(name: "QuestionRowOptions")
  columnOptions  Option[] @relation(name: "QuestionColumnOptions")
}

model Option {
  questionId              String
  question                Question  @relation(name:"QuestionOptions")
  rowQuestionOptionId     String?
  rowQuestionOptions      Question? @relation(name:"QuestionRowOptions")
  columnQuestionOptionId  String?
  columnQuestionOptions   Question? @relation(name:"QuestionColumnOptions")
}
```

## API Endpoints Affected

All these endpoints now properly handle grid options:

1. **POST /api/questions** - Create question
2. **PUT /api/questions/:id** - Update question
3. **GET /api/questions?id=xxx** - Get single question
4. **GET /api/questions?surveyId=xxx** - Get questions by survey
5. **GET /api/questions/survey/:surveyId** - Get questions by survey (alternative)

## Testing Recommendations

Test the following scenarios:

1. **Create multi-choice grid question**:
   - Send rowOptions and columnOptions arrays
   - Verify both are saved to database
   - Verify response includes both arrays

2. **Create checkbox grid question**:
   - Same as above

3. **Update grid question**:
   - Modify rowOptions and columnOptions
   - Verify old options are deleted
   - Verify new options are saved

4. **Retrieve grid questions**:
   - Get single question by ID
   - Get all questions for a survey
   - Verify rowOptions and columnOptions are included

5. **Survey creation with grid questions**:
   - Create survey with autoGenerateQuestions
   - Verify grid questions work correctly

## Example Request Format

```json
{
  "surveyId": "survey-id",
  "question_type": "TEXT",
  "question_text": "Rate the following items",
  "categoryId": "multi-choice-grid-category-id",
  "rowOptions": [
    { "text": "Item 1" },
    { "text": "Item 2" },
    { "text": "Item 3" }
  ],
  "columnOptions": [
    { "text": "Poor" },
    { "text": "Fair" },
    { "text": "Good" },
    { "text": "Excellent" }
  ],
  "order_index": 1,
  "required": true
}
```

## Example Response Format

```json
{
  "message": "Question created successfully",
  "question": {
    "id": "question-id",
    "question_text": "Rate the following items",
    "rowOptions": [
      { "id": "opt-1", "text": "Item 1", "rowQuestionOptionId": "question-id" },
      { "id": "opt-2", "text": "Item 2", "rowQuestionOptionId": "question-id" }
    ],
    "columnOptions": [
      { "id": "opt-3", "text": "Poor", "columnQuestionOptionId": "question-id" },
      { "id": "opt-4", "text": "Fair", "columnQuestionOptionId": "question-id" }
    ]
  }
}
```


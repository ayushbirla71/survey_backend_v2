export const questionTypeMap = {
  "short answer": "e690972c-0956-442e-a0b4-3c109c3d42f7",
  paragraph: "4234edbe-bb13-4acd-918b-ea83e3107eb4",
  number: "31e56215-bd1d-4614-9d89-275f32a22654",
  dropdown: "516210a8-16c5-465c-aa84-7a02b3c032a4",
  "multiple choice": "ad17eee6-d97e-4bdc-9870-2881ea2b391f",
  checkboxes: "86e2d9dc-2f36-47ff-b502-cc24532091d9",
  rating: "b0a418b1-f832-4b02-a44a-683008e6761b",
  "linear scale": "97140e9a-acf8-4293-93b6-022a6962bce1",
  "multi-choice grid": "d6c6b58e-0037-4295-a9ec-4a1b6ff03429",
  "checkbox grid": "60516591-f744-4efd-ae56-58d8e1ca911c",
  ranking: "ed797df3-c526-49a5-b6b8-05e2065f1a69",
  nps: "d7c4f652-d311-449a-ae48-f56898b235e4",
  date: "276364c5-1b96-4b4e-a362-833973532241",
  time: "d16778d4-85bc-4fac-8815-2bb2f1346fd9",
  "file upload": "56abdae6-9b0d-4313-9187-8330ae8121e5",
};

export const surveyCategories = [
  { id: "9c3523f5-0c5b-412e-a158-99e07b888bd3", name: "IT Sector" },
  { id: "e543505d-6a79-48a5-ba47-8c83e79e4e5b", name: "Automotive" },
  { id: "f1234567-1234-1234-1234-123456789abc", name: "Healthcare" },
  { id: "f2345678-2345-2345-2345-23456789abcd", name: "Education" },
  { id: "f3456789-3456-3456-3456-3456789abcde", name: "Retail" },
  { id: "f4567890-4567-4567-4567-456789abcdef", name: "Finance" },
  { id: "f5678901-5678-5678-5678-56789abcdef0", name: "Manufacturing" },
  { id: "f6789012-6789-6789-6789-6789abcdef01", name: "Entertainment" },
  { id: "f7890123-7890-7890-7890-789abcdef012", name: "Food & Beverage" },
  { id: "f8901234-8901-8901-8901-89abcdef0123", name: "Travel & Tourism" },
  { id: "f9012345-9012-9012-9012-9abcdef01234", name: "Real Estate" },
  { id: "fa123456-a123-a123-a123-abcdef012345", name: "Media" },
  { id: "fb234567-b234-b234-b234-bcdef0123456", name: "Sports" },
  { id: "fc345678-c345-c345-c345-cdef01234567", name: "Technology" },
  { id: "fd456789-d456-d456-d456-def012345678", name: "Energy" },
];

// I am only saving the Innovate MR TEST Credentials in the seeding
export const vendorAndConfig = [
  {
    key: "INNOVATEMR_TEST",
    name: "Innovate MR Test",
    apiConfig: {
      api_version: "v2",
      base_url: "https://stgbuyerapi.innovatesample.com/api/v2",
      auth_type: "API_KEY",
      credentials: {
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5NGFmYzk3N2I4ODVlY2M0MTI4MDRmNSIsInVzcl9pZCI6NDAxOCwidXNyX3R5cGUiOiJjdXN0b21lciIsImlhdCI6MTc2NjUyMjAwN30.Bmzh2pnxXkAWnJWbd1ShQR8gcZK-vN8pHDjULiRhbIY",
      },
    },
  },
];

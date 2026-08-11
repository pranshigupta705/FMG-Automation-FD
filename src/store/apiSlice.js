import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:3000' }), 
  endpoints: (builder) => ({
    
    // Fetches your live database queue
    getLivePetitions: builder.query({
      query: (date) => ({
        url: '/api/v1/qa/queue',
        params: {
          ...(date ? { date } : {}),
          _t: Date.now(),
        },
      }),
      transformResponse: (response) => {
        const payload = response?.data ?? response;
        const conversations = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        return conversations.map((conversation) => ({
          ...conversation,
          petitionId:
            conversation.petitionId ||
            conversation.petitionNumber ||
            conversation._id ||
            'UNKNOWN-ID',
          status: conversation.status || (conversation.isActive ? 'Active' : 'Pending QA'),
          customerName: conversation.customerName || conversation.customer?.name || 'Unknown',
          customerEmail: conversation.customerEmail || conversation.customer?.email,
          priority: conversation.priority || 'Low',
          category: conversation.category || 'General Inquiry',
          createdAt:
            conversation.createdAt ||
            conversation.created_at ||
            new Date().toISOString(),
          // Ensure messages/transcript is properly normalized
          interactionData: conversation.interactionData || conversation.messages || conversation.chatTranscript || '',
          petitionStatus: conversation.petitionStatus || conversation.status || 'Resolved',
          acceptedBy: conversation.acceptedBy || 'Unknown',
          assignedAgent: conversation.assignedAgent || 'Unknown',
        }));
      },
    }),

    // ✨ UPDATED: Evaluates a single petition using real properties passed from the frontend UI
    evaluatePetition: builder.mutation({
      query: (petitionObject) => ({
        url: `/api/v1/qa/evaluate`,
        method: 'POST',
        body: {
          interactionData: petitionObject.interactionData || petitionObject.messages,
          petitionStatus: petitionObject.petitionStatus || 'Resolved',
          acceptedBy: petitionObject.acceptedBy || 'Unknown',
          assignedAgent: petitionObject.assignedAgent || 'Unknown',
          category: petitionObject.category || 'General Inquiry'
        }
      }),
    }),

    // ✨ Bulk Evaluate & Log Mutation Endpoint (Already uses real selected petitions array)
    bulkEvaluateAndLog: builder.mutation({
      query: (selectedPetitions) => ({
        url: '/api/v1/qa/bulk-evaluate-and-log',
        method: 'POST',
        body: { 
          petitions: selectedPetitions 
        },
      }),
    }),

    // Dashboard Aggregator Endpoint
    getDashboardData: builder.query({
      query: (date) => {
        const queryParam = date ? `?date=${date}` : '';
        return `/api/v1/dashboard${queryParam}`;
      }
    }),
    
  }),
});

export const { 
  useGetLivePetitionsQuery, 
  useEvaluatePetitionMutation,
  useBulkEvaluateAndLogMutation,
  useGetDashboardDataQuery 
} = apiSlice;
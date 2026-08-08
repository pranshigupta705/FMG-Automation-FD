import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:3000' }), 
  endpoints: (builder) => ({
    
    // ✨ UPDATED: No more hard-coded data! This now fetches your live database queue.
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
          messages:
            conversation.messages ||
            conversation.interactionData?.messages ||
            conversation.chatTranscript ||
            [],
        }));
      },
    }),

    evaluatePetition: builder.mutation({
      query: ({ petitionId, token }) => ({
        url: `/api/v1/qa/evaluate`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: {
          // Note: If you want to pull real interaction data from your database later, 
          // we will update this body to stop using the hard-coded string too!
          interactionData: 
            `[Customer - Amelia Johnson]: I need help with my service issue for petition ${petitionId}\n` +
            `[Agent - Agent Smith]: Welcome to The Good Food Group. My name is Agent Smith. How may I assist you today?\n` +
            `[Customer - Amelia Johnson]: My customer ID is TGF/554403 and my phone is 555-555-1234.\n` +
            `[Agent - Agent Smith]: Thank you for verifying. I have successfully resolved your issue. Thank you for choosing us, have a wonderful day!`,
          metadata: { 
            petitionId: petitionId, 
            source: 'Frontend Dashboard' 
          },
          petitionStatus: 'Resolved',
          acceptedBy: 'Agent Smith',
          assignedAgent: 'Agent Smith'
        }
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
  useGetDashboardDataQuery 
} = apiSlice;
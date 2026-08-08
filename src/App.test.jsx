import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import App from "./App";
import * as apiSlice from "./store/apiSlice";

// 1. MOCK THE REDUX/RTK QUERY HOOKS
vi.mock("./store/apiSlice", () => ({
  useGetLivePetitionsQuery: vi.fn(),
  useEvaluatePetitionMutation: vi.fn(),
}));

describe("App.jsx - Comprehensive Unit & Regression Tests", () => {
  beforeEach(() => {
    // Setup default mock return for the queue
    apiSlice.useGetLivePetitionsQuery.mockReturnValue({
      data: [
        {
          petitionId: "PET-123",
          customerName: "Olivia Taylor",
          status: "PENDING",
          assignedAgent: "Charlie Evans",
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    });

    apiSlice.useEvaluatePetitionMutation.mockReturnValue([vi.fn()]);
  });

  it("[REGRESSION] Renders the two-column layout and table correctly", () => {
    render(<App />);

    // Verify Sidebar Form renders
    expect(screen.getByText("Log Observation")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. PET-1785...")).toBeInTheDocument();

    // Verify Table renders data
    expect(screen.getByText("PET-123")).toBeInTheDocument();
    expect(screen.getByText("Olivia Taylor")).toBeInTheDocument();
  });

  it("[UNIT] Toggles Dark/Light mode classes perfectly", () => {
    render(<App />);

    const themeButton = screen.getByTitle("Switch to Light Mode");
    const htmlRoot = document.documentElement;

    // Default should be dark
    expect(htmlRoot.classList.contains("dark")).toBe(true);

    // Click to toggle
    fireEvent.click(themeButton);
    expect(htmlRoot.classList.contains("dark")).toBe(false);
  });

  it("[UNIT] Status filter correctly hides non-matching petitions", () => {
    render(<App />);

    // PET-123 is PENDING, so it should be visible initially
    expect(screen.getByText("PET-123")).toBeInTheDocument();

    // Change filter to RESOLVED
    const filterSelect = screen.getByRole("combobox");
    fireEvent.change(filterSelect, { target: { value: "RESOLVED" } });

    // Table should now show the empty state
    expect(screen.queryByText("PET-123")).not.toBeInTheDocument();
    expect(
      screen.getByText("No petitions match the selected filters."),
    ).toBeInTheDocument();
  });

  it("[REGRESSION] populateFormFromEvaluation correctly extracts Agent Name and Rules", async () => {
    render(<App />);

    // Simulate clicking the "Test ID" button for a manual eval
    const manualInput = screen.getByPlaceholderText("Enter Petition ID...");
    const testButton = screen.getByText("Test ID");

    fireEvent.change(manualInput, { target: { value: "PET-123" } });

    // Mock the global fetch to return our simulated AI evaluation
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              agentName: "Charlie Evans",
              qaScore: 45,
              evaluation: {
                summary: "Poor performance",
                observations: [
                  { errorType: "CLOSING_ERROR", observation: "No closing." },
                ],
              },
            },
          }),
      }),
    );

    fireEvent.click(testButton);

    // Wait for the state to update the form
    await waitFor(() => {
      // Input values should now match the AI response
      expect(screen.getByDisplayValue("Charlie Evans")).toBeInTheDocument();
      expect(screen.getByDisplayValue("CLOSING_ERROR")).toBeInTheDocument();
      expect(screen.getByDisplayValue("45")).toBeInTheDocument();
    });
  });
});

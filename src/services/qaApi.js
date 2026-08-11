import axios from 'axios';

// Update this to match your backend port (e.g., port 3000)
const API_BASE_URL = 'http://localhost:3000/api/v1/qa';

/**
 * Triggers the backend bulk chunk evaluation and external logging.
 */
export const bulkEvaluateAndLog = async (selectedPetitions) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/bulk-evaluate-and-log`, {
            petitions: selectedPetitions
        });
        return response.data;
    } catch (error) {
        console.error("Bulk API Error:", error.response?.data || error.message);
        throw error.response?.data || { success: false, message: "Network error during bulk evaluation." };
    }
};
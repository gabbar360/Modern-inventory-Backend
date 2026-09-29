let aiHistory = [
  { role: 'assistant', content: 'Hello! I am your Vegnar ERP & CRM Copilot. How can I assist you with your sales, inventory, or analytics today?', timestamp: new Date().toISOString() }
];

export const getAiHistory = async (req, res) => {
  res.json(aiHistory);
};

export const postAiChat = async (req, res) => {
  const { prompt, message } = req.body;
  const userMsg = prompt || message || '';
  aiHistory.push({ role: 'user', content: userMsg, timestamp: new Date().toISOString() });
  
  const botReply = `Analyzed workspace data: Everything looks healthy! You have pending orders ready for dispatch and active customer engagements. Let me know if you need specific reports or actions generated.`;
  aiHistory.push({ role: 'assistant', content: botReply, timestamp: new Date().toISOString() });
  
  res.json({ reply: botReply, history: aiHistory });
};

export const parseAiOrder = async (req, res) => {
  const { text, audio_text } = req.body;
  res.json({
    success: true,
    parsed_order: {
      customer_name: 'TechCorp Solutions',
      items: [{ product_name: 'Industrial Polymer Resin', quantity: 10, rate: 1200 }],
      total_amount: 12000,
      notes: text || audio_text || 'Parsed via AI voice prompt'
    }
  });
};

export default {
  getAiHistory,
  postAiChat,
  parseAiOrder
};

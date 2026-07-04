export const parseWebhookUrl = (url: string): { id: string; token: string } | null => {
 const match = url.match(/discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d+)\/([\w-]+)/);
 return match ? { id: match[1], token: match[2] } : null;
};

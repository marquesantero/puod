export interface DecodedToken {
  sub: string;
  exp: number;
  permissions?: string | string[];
  roles?: string;
  // add other claims as needed
}

export function decodeJwt(token: string): DecodedToken | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function getUserPermissions(): string[] {
  const token = localStorage.getItem("accessToken");
  if (!token) return [];
  
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.permissions) return [];

  // JWT might return a single string or an array depending on how backend serialized it
  if (Array.isArray(decoded.permissions)) {
      return decoded.permissions;
  }
  return [decoded.permissions];
}

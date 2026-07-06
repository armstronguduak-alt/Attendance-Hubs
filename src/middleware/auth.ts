import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.ts';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.error('Error verifying Supabase token:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    
    req.user = {
      uid: user.id,
      email: user.email,
      name: user.user_metadata?.display_name || user.user_metadata?.name || '',
    };
    next();
  } catch (error) {
    console.error('Error verifying Supabase token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user) {
      req.user = {
        uid: user.id,
        email: user.email,
        name: user.user_metadata?.display_name || user.user_metadata?.name || '',
      };
    }
  } catch (error) {
    // Treat invalid or expired token as guest
  }
  next();
};


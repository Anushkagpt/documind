import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getStore } from '../lib/store';
import { signToken } from '../middleware/auth';

const router = Router();

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(80).optional(),
});

function publicUser(user: { id: string; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

router.post('/register', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const { email, password, name } = parsed.data;
  const store = getStore();
  const existing = await store.findUserByEmail(email.toLowerCase());
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await store.createUser(email.toLowerCase(), name || null, passwordHash);
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const parsed = credentials.omit({ name: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
    return;
  }
  const store = getStore();
  const user = await store.findUserByEmail(parsed.data.email.toLowerCase());
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: 'Wrong email or password' });
    return;
  }
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

export default router;

import { Router } from 'express';
import multer from 'multer';
// pdf-parse has no bundled types; see src/types.d.ts
import pdfParse from 'pdf-parse';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { getStore } from '../lib/store';
import { enqueueIngestion } from '../lib/queue';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res) => {
  const store = getStore();
  const documents = await store.listDocuments(req.userId!);
  res.json({ documents });
});

const textUpload = z.object({
  title: z.string().min(1).max(200),
  text: z.string().min(20),
});

/** Accepts either JSON {title, text} or multipart with a .txt/.md/.pdf file. */
router.post('/', upload.single('file'), async (req: AuthedRequest, res) => {
  const store = getStore();
  let title = '';
  let text = '';
  let sourceType = 'text';

  if (req.file) {
    const original = req.file.originalname || 'document';
    title = (req.body.title as string) || original.replace(/\.[^.]+$/, '');
    if (original.toLowerCase().endsWith('.pdf')) {
      sourceType = 'pdf';
      try {
        const parsed = await pdfParse(req.file.buffer);
        text = parsed.text;
      } catch {
        res.status(422).json({ error: 'Could not extract text from this PDF' });
        return;
      }
    } else {
      text = req.file.buffer.toString('utf8');
    }
  } else {
    const parsed = textUpload.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Provide JSON {title, text} or a .txt/.md/.pdf file' });
      return;
    }
    title = parsed.data.title;
    text = parsed.data.text;
  }

  if (!text || text.trim().length < 20) {
    res.status(422).json({ error: 'Document has too little text to index (min 20 chars)' });
    return;
  }

  const document = await store.createDocument(req.userId!, title.slice(0, 200), sourceType);
  await enqueueIngestion(document.id, text);
  res.status(202).json({ document });
});

router.get('/:id', async (req: AuthedRequest, res) => {
  const store = getStore();
  const document = await store.getDocument(req.userId!, req.params.id);
  if (!document) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json({ document });
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  const store = getStore();
  const deleted = await store.deleteDocument(req.userId!, req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.status(204).end();
});

export default router;

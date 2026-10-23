import { z } from 'zod';

/**
 * Schema de validação Zod para autenticação (RT-04).
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'O e-mail é obrigatório.')
    .email('Informe um e-mail com formato válido.'),
  password: z
    .string()
    .min(1, 'A senha é obrigatória.'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

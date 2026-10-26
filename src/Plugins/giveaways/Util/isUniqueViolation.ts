const uniqueViolation = 'P2002';

export default (error: unknown) =>
 !!error && typeof error === 'object' && 'code' in error && error.code === uniqueViolation;

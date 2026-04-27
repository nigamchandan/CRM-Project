import api from './api';

export const login    = (data) => api.post('/auth/login',    data).then((r) => r.data);
export const register = (data) => api.post('/auth/register', data).then((r) => r.data);
export const me       = ()     => api.get ('/auth/me')             .then((r) => r.data);
export const logout   = ()     => api.post('/auth/logout')         .then((r) => r.data);

/** Update own profile (name, email). Returns the fresh sanitized user. */
export const updateMe       = (data) => api.patch('/auth/me',           data).then((r) => r.data);

/** Change own password. Requires current_password + new_password. */
export const changePassword = (data) => api.post ('/auth/me/password',  data).then((r) => r.data);

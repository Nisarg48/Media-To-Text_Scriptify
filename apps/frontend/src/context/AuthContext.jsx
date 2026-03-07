import { createContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token') || null);
    const navigate = useNavigate();

    const login = (newToken, nextPath) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        navigate(nextPath || '/dashboard', { replace: true });
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        navigate('/', { replace: true });
    };

    return (
        <AuthContext.Provider value={{ token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
import { Routes, Route } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import LoginForm from './components/auth/LoginForm';
import DashBoard from './pages/DashBoard';
import Farms from './pages/Farms';
import Equipments from './pages/Equipments';
import FieldJobs from './pages/FieldJobs';
import Operators from './pages/Operators';
import ServiceReports from './pages/ServiceReports';
import Users from './pages/Users';

function AppContent() {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? <Routes>
        <Route path='/' element={<DashBoard />} />
        <Route path='/farms' element={<Farms />} />
        <Route path='/equipments' element={<Equipments />} />
        <Route path='/field-jobs' element={<FieldJobs />} />
        <Route path='/operators' element={<Operators />} />
        <Route path='/service-reports' element={<ServiceReports />} />
        <Route path='/users' element={<Users />} />
    </Routes> : <LoginForm />;
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
// Navigation bar shown at the top of every authenticated page.
// Shows the user's name, role, and logout button.

import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="bg-white border-b shadow-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/tickets" className="font-bold text-lg text-blue-700">Helpdesk</Link>
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">{user.name} <span className="text-gray-400">({user.role})</span></span>
            <button onClick={handleLogout} className="text-red-600 hover:underline">Logout</button>
          </div>
        )}
      </div>
    </nav>
  );
}
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Measure from "@/pages/Measure";
import Posture from "@/pages/Posture";
import Report from "@/pages/Report";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/measure" element={<Measure />} />
          <Route path="/posture" element={<Posture />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </Layout>
    </Router>
  );
}

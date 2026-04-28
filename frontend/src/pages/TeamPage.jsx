import { useEffect, useState } from "react";

import { changePassword, getMyTeam, updateMyTeamProfile } from "../services/api";

function TeamPage({ token }) {
  const [team, setTeam] = useState(null);
  const [draftMembers, setDraftMembers] = useState([]);
  const [notes, setNotes] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getMyTeam(token)
      .then((res) => {
        setTeam(res);
        setDraftMembers(res.member_profiles || []);
        setNotes(res.notes || "");
      })
      .catch((e) => setError(e.message));
  }, [token]);

  const updateMember = (index, key, value) => {
    setDraftMembers((prev) =>
      prev.map((member, idx) => (idx === index ? { ...member, [key]: value } : member))
    );
  };

  const addMember = () => {
    setDraftMembers((prev) => [...prev, { full_name: "", student_id: "", email: "" }]);
  };

  const removeMember = (index) => {
    setDraftMembers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const saveProfile = async () => {
    setError("");
    setSuccess("");
    try {
      const cleanedMembers = draftMembers
        .map((m) => ({
          full_name: (m.full_name || "").trim(),
          student_id: (m.student_id || "").trim(),
          email: (m.email || "").trim(),
        }))
        .filter((m) => m.full_name);

      const updated = await updateMyTeamProfile(
        {
          members: cleanedMembers,
          notes,
        },
        token
      );
      setTeam(updated);
      setDraftMembers(updated.member_profiles || []);
      setNotes(updated.notes || "");
      setSuccess("Team member profile saved.");
    } catch (e) {
      setError(e.message);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await changePassword(currentPassword, newPassword, token);
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password updated successfully.");
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!team) return <p>Loading...</p>;

  return (
    <section className="panel team-panel">
      <h2>Team Management</h2>
      <p>
        <strong>Team Name:</strong> {team.name}
      </p>
      <p>
        <strong>Shared Account:</strong> {team.members[0]?.username || "-"}
      </p>

      <h3>Group Member Information</h3>
      <p>All group members use one account. Please keep member list updated for scoring transparency.</p>
      <div className="member-list">
        {draftMembers.length === 0 ? <p>No member profile yet.</p> : null}
        {draftMembers.map((member, idx) => (
          <article className="member-card" key={`member-${idx}`}>
            <label>
              Full name
              <input
                value={member.full_name || ""}
                onChange={(e) => updateMember(idx, "full_name", e.target.value)}
                placeholder="Nguyen Van A"
              />
            </label>
            <label>
              Student ID
              <input
                value={member.student_id || ""}
                onChange={(e) => updateMember(idx, "student_id", e.target.value)}
                placeholder="2252xxxx"
              />
            </label>
            <label>
              Email
              <input
                value={member.email || ""}
                onChange={(e) => updateMember(idx, "email", e.target.value)}
                placeholder="team@example.com"
              />
            </label>
            <button type="button" onClick={() => removeMember(idx)}>
              Remove member
            </button>
          </article>
        ))}
      </div>

      <button type="button" onClick={addMember}>
        Add member
      </button>
      <label>
        Team notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Optional notes for admin and score review."
        />
      </label>
      <button type="button" onClick={saveProfile}>
        Save team profile
      </button>

      <h3>Change Shared Password</h3>
      <form onSubmit={updatePassword}>
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </label>
        <label>
          New password (&gt;= 8 chars)
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <button type="submit">Update password</button>
      </form>

      {success ? <p className="success">{success}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

export default TeamPage;

import React from 'react';
import { Link } from 'react-router-dom';
import { CircleUserRound } from 'lucide-react';

const MAX_VISIBLE_MEMBERS = 8;

export const MembersList = ({ members = [] }) => {
    const safeMembers = Array.isArray(members) ? members.filter((member) => member?._id) : [];
    const visibleMembers = safeMembers.slice(0, MAX_VISIBLE_MEMBERS);
    const hiddenCount = Math.max(0, safeMembers.length - visibleMembers.length);

    if (!safeMembers.length) {
        return null;
    }

    return (
        <section className="lattice-members-section" aria-label="Lattice members">
            <div className="lattice-members-header">
                <h2>Members</h2>
                <span>{safeMembers.length}</span>
            </div>

            <div className="lattice-members-grid">
                {visibleMembers.map((member) => (
                    <Link key={member._id} to={`/profile/${member._id}`} className="lattice-member-chip" title={`View ${member.name || 'member'} profile`}>
                        <span className="lattice-member-avatar" aria-hidden="true">
                            {member.avatar ? (
                                <img src={member.avatar} alt={`${member.name || 'Member'} avatar`} className="lattice-member-avatar-image" />
                            ) : (
                                <CircleUserRound size={17} strokeWidth={1.8} />
                            )}
                        </span>

                        <span className="lattice-member-name">{member.name || 'Member'}</span>

                        {member.isOwner ? <span className="lattice-member-owner-badge">Owner</span> : null}
                    </Link>
                ))}

                {hiddenCount > 0 ? <span className="lattice-member-more">+{hiddenCount} more</span> : null}
            </div>
        </section>
    );
};

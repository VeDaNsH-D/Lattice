import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Mail } from 'lucide-react';
import { apiRequest } from '../utils/api';
import './InviteResponsePage.css';

export const InviteResponsePage = () => {
    const { inviteId } = useParams();
    const navigate = useNavigate();
    const [submittingAction, setSubmittingAction] = useState(null);
    const [resultState, setResultState] = useState({ type: 'idle', message: '' });

    const token = localStorage.getItem('token');

    const redirectToLogin = useMemo(() => {
        const target = `/invite/${inviteId}`;
        return `/login?redirect=${encodeURIComponent(target)}`;
    }, [inviteId]);

    const onInviteAction = async (action) => {
        if (!token) {
            navigate(redirectToLogin);
            return;
        }

        setSubmittingAction(action);
        setResultState({ type: 'idle', message: '' });

        try {
            const response = await apiRequest(`/invites/${inviteId}/${action}`, {
                method: 'POST',
            });

            setResultState({
                type: action === 'accept' ? 'success' : 'neutral',
                message: response?.message || (action === 'accept' ? 'Invitation accepted.' : 'Invitation rejected.'),
            });
        } catch (error) {
            setResultState({ type: 'error', message: error.message || 'Unable to process invitation.' });
        } finally {
            setSubmittingAction(null);
        }
    };

    return (
        <div className="invite-page-shell">
            <div className="invite-card">
                <div className="invite-title-wrap">
                    <span className="invite-icon"><Mail size={18} /></span>
                    <h1>Project Invitation</h1>
                </div>
                <p className="invite-subtitle">Choose whether you want to join this collaborative workspace.</p>

                {!token ? (
                    <div className="invite-auth-warning">
                        <p>You need to log in with the invited email account before responding.</p>
                        <Link to={redirectToLogin} className="invite-login-btn">Login to Continue</Link>
                    </div>
                ) : null}

                <div className="invite-action-row">
                    <button
                        type="button"
                        className="invite-btn invite-btn-accept"
                        disabled={!token || Boolean(submittingAction)}
                        onClick={() => onInviteAction('accept')}
                    >
                        <CheckCircle2 size={16} />
                        {submittingAction === 'accept' ? 'Accepting...' : 'Accept Invite'}
                    </button>

                    <button
                        type="button"
                        className="invite-btn invite-btn-reject"
                        disabled={!token || Boolean(submittingAction)}
                        onClick={() => onInviteAction('reject')}
                    >
                        <XCircle size={16} />
                        {submittingAction === 'reject' ? 'Rejecting...' : 'Reject Invite'}
                    </button>
                </div>

                {resultState.message ? (
                    <p className={`invite-feedback invite-feedback-${resultState.type}`}>{resultState.message}</p>
                ) : null}

                <div className="invite-footer-links">
                    <Link to="/lattice">Go to Dashboard</Link>
                </div>
            </div>
        </div>
    );
};

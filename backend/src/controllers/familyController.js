'use strict';

const UserModel = require('../models/userModel.js');

function calcAge(dob) {
    if (!dob) return null;
    const d = new Date(dob), t = new Date();
    let age = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) age--;
    return age;
}

class FamilyController {
    constructor() {
        this.userModel = new UserModel();
    }

    // GET /api/family/my-code
    getMyCode = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });
            const code = await this.userModel.getOrCreateShareCode(userId);
            return res.status(200).json({ success: true, code });
        } catch (err) {
            console.error('[Family] getMyCode:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    // POST /api/family/my-code/regenerate
    regenerateCode = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });
            const code = await this.userModel.regenerateShareCode(userId);
            return res.status(200).json({ success: true, code });
        } catch (err) {
            console.error('[Family] regenerateCode:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    // POST /api/family/lookup  { code }
    lookupCode = async (req, res) => {
        try {
            const requesterId = req.user?.id;
            const { code } = req.body || {};
            if (!code?.trim()) return res.status(400).json({ success: false, error: 'Code is required' });

            const member = await this.userModel.lookupByShareCode(code);
            if (!member) return res.status(404).json({ success: false, error: 'Code not found. Please check and try again.' });
            if (member.id === requesterId) return res.status(400).json({ success: false, error: 'You cannot link to your own account.' });

            return res.status(200).json({
                success: true,
                preview: {
                    userId:     member.id,
                    name:       member.name       || 'RxSense User',
                    age:        calcAge(member.date_of_birth),
                    gender:     member.gender     || null,
                    bloodGroup: member.blood_group || null,
                },
            });
        } catch (err) {
            console.error('[Family] lookupCode:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    // POST /api/family/link  { code, relationship }
    linkMember = async (req, res) => {
        try {
            const requesterId = req.user?.id;
            const { code, relationship } = req.body || {};
            if (!code?.trim())        return res.status(400).json({ success: false, error: 'Code is required' });
            if (!relationship?.trim()) return res.status(400).json({ success: false, error: 'Relationship is required' });

            const member = await this.userModel.lookupByShareCode(code);
            if (!member) return res.status(404).json({ success: false, error: 'Code not found.' });
            if (member.id === requesterId) return res.status(400).json({ success: false, error: 'Cannot link to yourself.' });

            const link = await this.userModel.createFamilyLink(requesterId, member.id, relationship);
            return res.status(201).json({ success: true, link });
        } catch (err) {
            console.error('[Family] linkMember:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    // GET /api/family/members
    getMembers = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });

            const rows = await this.userModel.getFamilyLinks(userId);

            const members = rows.map((r) => ({
                linkId:       r.link_id,
                relationship: r.relationship,
                linkedAt:     r.linked_at,
                member: {
                    userId:             r.member_user_id,
                    name:               r.name            || 'RxSense User',
                    age:                calcAge(r.date_of_birth),
                    gender:             r.gender          || null,
                    bloodGroup:         r.blood_group     || null,
                    weight:             r.weight          || null,
                    bpSystolic:         r.blood_pressure_systolic  || null,
                    bpDiastolic:        r.blood_pressure_diastolic || null,
                    activeConditions:   Array.isArray(r.active_conditions) ? r.active_conditions : [],
                    allergyCount:       parseInt(r.allergy_count || 0),
                    lastReportAt:       r.last_report_at  || null,
                },
            }));

            return res.status(200).json({ success: true, members });
        } catch (err) {
            console.error('[Family] getMembers:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    // GET /api/family/members/:linkId/health
    getMemberHealth = async (req, res) => {
        try {
            const userId = req.user?.id;
            const { linkId } = req.params;
            if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });

            const health = await this.userModel.getFamilyMemberHealth(userId, linkId);
            if (!health) return res.status(404).json({ success: false, error: 'Link not found or access denied.' });

            return res.status(200).json({
                success: true,
                health: {
                    ...health,
                    age: calcAge(health.date_of_birth),
                    conditions: health.conditions || [],
                    allergies:  health.allergies  || [],
                },
            });
        } catch (err) {
            console.error('[Family] getMemberHealth:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };

    // DELETE /api/family/link/:linkId
    removeLink = async (req, res) => {
        try {
            const userId = req.user?.id;
            const { linkId } = req.params;
            if (!userId) return res.status(401).json({ success: false, error: 'Auth required' });

            const removed = await this.userModel.removeFamilyLink(userId, linkId);
            if (!removed) return res.status(404).json({ success: false, error: 'Link not found.' });

            return res.status(200).json({ success: true });
        } catch (err) {
            console.error('[Family] removeLink:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
    };
}

module.exports = FamilyController;

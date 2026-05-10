import fs from 'fs';

let content = fs.readFileSync('app.js', 'utf8');

const replacements = [
    [/document\.getElementById\('loginPromptModal'\)\.style\.display\s*=\s*'flex';?/g, "openModal(document.getElementById('loginPromptModal'));"],
    [/loginPromptModal\.style\.display\s*=\s*'flex';?/g, "openModal(loginPromptModal);"],
    [/loginPromptModal\.style\.display\s*=\s*'none';?/g, "closeModal(loginPromptModal);"],

    [/document\.getElementById\('reviewModal'\)\.style\.display\s*=\s*'flex';?/g, "openModal(document.getElementById('reviewModal'));"],
    [/document\.getElementById\('reviewModal'\)\.style\.display\s*=\s*'none';?/g, "closeModal(document.getElementById('reviewModal'));"],

    [/document\.getElementById\('adminRequestsModal'\)\.style\.display\s*=\s*'flex';?/g, "openModal(document.getElementById('adminRequestsModal'));"],
    [/document\.getElementById\('adminRequestsModal'\)\.style\.display\s*=\s*'none';?/g, "closeModal(document.getElementById('adminRequestsModal'));"],

    [/hireRequestModal\.style\.display\s*=\s*'flex';?/g, "openModal(hireRequestModal);"],
    [/hireRequestModal\.style\.display\s*=\s*'none';?/g, "closeModal(hireRequestModal);"],

    [/adminPinModal\.style\.display\s*=\s*'none';?/g, "closeModal(adminPinModal);"],

    [/document\.getElementById\('adminUserProfileModal'\)\.style\.display\s*=\s*'flex';?/g, "openModal(document.getElementById('adminUserProfileModal'));"],
    [/document\.getElementById\('adminUserProfileModal'\)\.style\.display\s*=\s*'none';?/g, "closeModal(document.getElementById('adminUserProfileModal'));"],

    [/editorFormModal\.style\.display\s*=\s*'flex';?/g, "openModal(editorFormModal);"],
    [/editorFormModal\.style\.display\s*=\s*'none';?/g, "closeModal(editorFormModal);"],

    [/document\.getElementById\('featuredManagerModal'\)\.style\.display\s*=\s*'flex';?/g, "openModal(document.getElementById('featuredManagerModal'));"],
    [/document\.getElementById\('featuredManagerModal'\)\.style\.display\s*=\s*'none';?/g, "closeModal(document.getElementById('featuredManagerModal'));"],

    [/supportChatModal\.style\.display\s*=\s*'flex';?/g, "openModal(supportChatModal);"],
    [/supportChatModal\.style\.display\s*=\s*'none';?/g, "closeModal(supportChatModal);"],

    [/adminSupportChatsModal\.style\.display\s*=\s*'flex';?/g, "openModal(adminSupportChatsModal);"],
    [/adminSupportChatsModal\.style\.display\s*=\s*'none';?/g, "closeModal(adminSupportChatsModal);"],

    [/addAdminManagerModal\.style\.display\s*=\s*'flex';?/g, "openModal(addAdminManagerModal);"],
    [/addAdminManagerModal\.style\.display\s*=\s*'none';?/g, "closeModal(addAdminManagerModal);"],

    [/aiSupportChatModal\.style\.display\s*=\s*'flex';?/g, "openModal(aiSupportChatModal);"],
    [/aiSupportChatModal\.style\.display\s*=\s*'none';?/g, "closeModal(aiSupportChatModal);"],

    [/contactModal\.style\.display\s*=\s*'none';?/g, "closeModal(contactModal);"],
    
    // Add successModal and editResetWarningModal and others just in case
    [/successOverlay\.style\.display\s*=\s*'flex';?/g, "openModal(successOverlay);"],
    [/editResetWarningModal\.style\.display\s*=\s*'flex';?/g, "openModal(editResetWarningModal);"],
    [/editResetWarningModal\.style\.display\s*=\s*'none';?/g, "closeModal(editResetWarningModal);"],

    [/jobDashboardModal\.style\.display\s*=\s*'none';?/g, "closeModal(jobDashboardModal);"],
    
    [/successProfileModal\.style\.display\s*=\s*'none';?/g, "closeModal(document.getElementById('successProfileModal'));"]
];

replacements.forEach(([regex, replacement]) => {
    content = content.replace(regex, replacement);
});

fs.writeFileSync('app.js', content);
console.log("Replacements done.");

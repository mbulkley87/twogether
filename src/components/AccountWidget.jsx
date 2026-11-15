// Always visible, same shared-identity widget as the other games. Doesn't
// gate anything: play works fully logged-out, this is purely about
// appearing on the leaderboard.
function AccountWidget({ isLoggedIn, isChecking, username, onSignIn, onSignOut }) {
  if (isChecking) return null

  return (
    <div className="account-widget">
      {isLoggedIn ? (
        <>
          <span className="account-widget-username">👤 {username}</span>
          <button type="button" className="account-widget-button" onClick={onSignOut}>
            Sign Out
          </button>
        </>
      ) : (
        <button type="button" className="account-widget-button" onClick={onSignIn}>
          Sign In
        </button>
      )}
    </div>
  )
}

export default AccountWidget

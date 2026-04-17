const httpControl = {
  host: '127.0.0.1',
  port: 3001
}

const serverMessages = {
  controlMessages: {
    knockDisabled: ' moonos1Redflag !тик команда вимкнена',
    knockEnabled: ' moonos1Greenflag !тик команда увімкнена',
    starfallDisabled: ' moonos1Redflag Зорепад вимкнено',
    starfallEnabled: ' moonos1Greenflag Зорепад увімкнено',
    bothGamesEnabled: ' moonos1Greenflag всі ігри увімкнено!',
    bothGamesDisabled: ' moonos1Redflag всі ігри вимкнено!',
    knockStatus: '📊 Статус !тик: {status}',
    starfallStatus: '📊 Статус зорепаду: {status}',
    mehDisabled: ' moonos1Redflag !бля команда вимкнена',
    mehEnabled: ' moonos1Greenflag !бля команда увімкнена',
    mehStatus: '📊 Статус !бля: {status}',
    overallStatus: '📊 Загальний статус: !тик - {knockStatus}, !зорепад - {starfallStatus}, !бля - {retypeWordStatus}, космоігри - {cosmosStatus}',
    healthCheck: 'moonos1Greenflag Система працює нормально',
    cosmosDisabled: ' moonos1Redflag космоігри вимкнено',
    cosmosEnabled: ' moonos1Greenflag космоігри увімкнено',
    cosmosStatus: '📊 Статус космоігр: {status}',
    cosmosFeaturesEnabled: ' moonos1Greenflag всі функції космоігр увімкнено',
    cosmosFeaturesDisabled:' moonos1Redflag всі функції космоігр вимкнено',
    // Per-feature messages are optional. If absent the route sends a plain JSON
    // response without a chat message (fail-silent).
    cosmos_spin_enabled:      ' moonos1Greenflag !spin увімкнено',
    cosmos_spin_disabled:     ' moonos1Redflag !spin вимкнено',
    cosmos_dice_enabled:      ' moonos1Greenflag !dice увімкнено',
    cosmos_dice_disabled:     ' moonos1Redflag !dice вимкнено',
    cosmos_duel_enabled:      ' moonos1Greenflag !duel увімкнено',
    cosmos_duel_disabled:     ' moonos1Redflag !duel вимкнено',
    cosmos_box_enabled:       ' moonos1Greenflag !box увімкнено',
    cosmos_box_disabled:      ' moonos1Redflag !box вимкнено',
    cosmos_daily_enabled:     ' moonos1Greenflag !daily увімкнено',
    cosmos_daily_disabled:    ' moonos1Redflag !daily вимкнено',
    cosmos_blackjack_enabled: ' moonos1Greenflag !bj увімкнено',
    cosmos_blackjack_disabled:' moonos1Redflag !bj вимкнено',
  },
  statusTexts: {
    enabled: 'увімкнено',
    disabled: 'вимкнено'
  }
}

const rolesMap = {
  '1': 'user',
  '2': 'external',
  '3': 'moderator',
  '4': 'broadcaster'
}

export { httpControl, serverMessages, rolesMap };
export default { httpControl, serverMessages, rolesMap };

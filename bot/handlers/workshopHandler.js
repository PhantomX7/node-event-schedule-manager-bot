const _ = require('lodash')
const moment = require('moment')
const db = require('../../models')
const template = require('../template')
const { withFlashes } = require('../flash')
const helper = require('../helper')

function paginize(workshops) {
  const makePaginationCard = (direction, page) => (
    {
      title: ' ',
      text: ' ',
      menuItems: [
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!workshop_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "Previous" : "Next", data: `!workshop_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!workshop_view ${page}` }
      ]
    }
  )
  const makeWorkshopCard = (workshopEntry) => {
    const expiredStatus = moment(moment().format('YYYY-MM-DD')).diff(moment(moment(workshopEntry[1].date).format('YYYY-MM-DD'))) >= 24*60*60*1000 ? ' - Expired' : ''
    return {
      title: `[${+workshopEntry[0] + 1}${expiredStatus}] ${workshopEntry[1].name}`,
      text: moment(workshopEntry[1].date).format('D MMMM YYYY (HH:mm)'),
      menuItems: [
        { type: 'postback', label: "View Detail", data: `!workshop_detail ${workshopEntry[1]._id}` },
        { type: 'postback', label: "Edit", data: `!workshop_edit_template ${workshopEntry[1]._id}` },
        { type: 'postback', label: "Delete", data: `!workshop_delete_confirm ${workshopEntry[1]._id}` }
      ]
    }
  }

  const workshopEntries = _.chain(workshops)
    .sortBy([
      workshop => moment(moment().format('YYYY-MM-DD')).diff(moment(moment(workshop.date).format('YYYY-MM-DD'))) >= 24*60*60*1000 ? 1 : 0,
      workshop => moment(workshop.date).valueOf()
    ])
    .entries()
    .value()

  if (workshopEntries.length <= 9) {
    return [ workshopEntries.map(workshopEntry => makeWorkshopCard(workshopEntry)) ]
  } else {
    const front = [ 
      ..._.chain(workshopEntries)
        .slice(0, 8)
        .map(workshopEntry => makeWorkshopCard(workshopEntry))
        .value(),
      makePaginationCard('next', 1)
    ]
    const middle = _.chain(workshopEntries)
      .slice(8, workshopEntries.length - ((workshopEntries.length - 8) % 7))
      .chunk(7)
      .map((chunk, index) => [
        makePaginationCard('previous', index),
        ..._.map(chunk, workshopEntry => makeWorkshopCard(workshopEntry)),
        makePaginationCard('next', index + 2)
      ])
      .value()
    const back = [
      makePaginationCard('previous', middle.length),
      ..._.chain(workshopEntries)
        .slice(workshopEntries.length - ((workshopEntries.length - 8) % 7))
        .map(workshopEntry => makeWorkshopCard(workshopEntry))
        .value()
    ]
    return [ front, ...middle, back ]
  }
}

async function getViewWorkshopMenu(evt, page) {
  const { userId, groupId, type } = evt.source
  const workshops = await db.Event.find(_.assign(
    { 
      type: 'workshop',
      envType: type 
    },
    ( type === 'user' ? { createdBy: userId } : { groupId } )
  ))
  
  const pages = paginize(workshops)

  page = page || 0
  if (page < 0 || page >= pages.length) return 'Page out of bound!'

  return template.makeCarousel(
    {
      title: 'All Workshops',
      columns: [
        {
          title: "All Workshops",
          text: workshops.length > 0 ? "Choose an action" : "No workshops yet",
          menuItems: [
            { type: 'postback', label: " ", data: " " },
            { type: 'postback', label: "Add", data: "!workshop_add_template" },
            { type: 'postback', label: "Back to Menu", data: "!woy" }
          ]
        },
        ...pages[page]
      ]
    }
  )
}

async function handler(bot, evt, command, arguments) {

  if (command === '!workshop_view') {
    if (![0, 1].includes(_.size(arguments)))
        return await evt.reply(withFlashes('Arguments must be exactly 0 or 1!'))
    await evt.reply(withFlashes(await getViewWorkshopMenu(evt, +(arguments[0] || 0))))
  } else if (command === '!workshop_detail') {
    try {
      if (_.size(arguments) !== 1)
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Workshop not found!'))

      const profile = await bot.getUserProfile(event.createdBy)
      await evt.reply(withFlashes(
        helper.trimAround(`
          [Workshop Detail]
          Name: ${event.name}
          Date: ${moment(event.date).format('D MMMM YYYY (HH:mm)')}
          Created By: ${profile.displayName}
          Created At: ${moment(event.createdAt).format('D MMMM YYYY (HH:mm)')}
        `)
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else if (command === '!workshop_add') {
    try {
      if (_.size(arguments) !== 2)
        return await evt.reply(withFlashes('Arguments must be exactly 2!'))
      if (!moment(arguments[1], 'D-M-YYYY#H:m', true).isValid()) 
        return await evt.reply(withFlashes('Invalid date!'))

      const { userId, groupId, type } = evt.source
      await db.Event.create(
        {
          name: arguments[0],
          date: moment(arguments[1], 'D-M-YYYY#H:m').toDate(),
          createdBy: userId,
          groupId: groupId || null,
          envType: type,
          type: 'workshop'
        }
      )
      await evt.reply(withFlashes(
        await getViewWorkshopMenu(evt),
        'Workshop created succesfully!'
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!workshop_add_template') {
    await evt.reply(withFlashes(
      `Please copy below input template and replace "workshop name" and "date" as you wish, then Send`,
      `!workshop_add "workshop name" ${moment().format('DD-MM-YYYY#HH:mm')}`
    ))
  


  } else if (command === '!workshop_delete') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Workshop not found!'))

      await event.remove()
      await evt.reply(withFlashes(
        await getViewWorkshopMenu(evt),
        'Workshop deleted successfully!'
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!workshop_delete_confirm') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Workshop not found!'))

      await evt.reply(withFlashes(
        template.makeConfirm(
          {
            title: `Delete ${event.name} [${moment().format('D MMMM YYYY (HH:mm)')}] ?`,
            type: 'postback',
            yesText: `!workshop_delete ${event._id}`,
            noText: `!workshop_view`
          }
        )
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else if (command === '!workshop_edit') {
    try {
      if (_.size(arguments) !== 3) 
        return await evt.reply(withFlashes('Arguments must be exactly 3!'))
      if (!moment(arguments[2], 'D-M-YYYY#H:m', true).isValid()) 
        return await evt.reply(withFlashes('Invalid date!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Workshop not found!'))

      event.name = arguments[1]
      event.date = moment(arguments[2], 'D-M-YYYY#H:m').toDate()
      await event.save()
      await evt.reply(withFlashes(
        await getViewWorkshopMenu(evt),
        `Workshop edited successfully!`
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!workshop_edit_template') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Workshop not found!'))

      await evt.reply(withFlashes(
        `Please copy below edit template and replace "workshop name" and "date" as you wish, then Send`,
        `!workshop_edit ${event._id} "${event.name}" ${moment(event.date).format('DD-MM-YYYY#HH:mm')}`
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else {
    await evt.reply(withFlashes())
  }
}

module.exports = handler
const _ = require('lodash')
const moment = require('moment')
const db = require('../../models')
const template = require('../template')
const { withFlashes } = require('../flash')
const helper = require('../helper')

function paginize(seminars) {
  const makePaginationCard = (direction, page) => (
    {
      title: ' ',
      text: ' ',
      menuItems: [
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!seminar_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "Previous" : "Next", data: `!seminar_view ${page}` },
        { type: 'postback', label: direction === 'previous' ? "<<<" : ">>>", data: `!seminar_view ${page}` }
      ]
    }
  )
  const makeSeminarCard = (seminarEntry) => {
    const expiredStatus = moment(moment().format('YYYY-MM-DD')).diff(moment(moment(seminarEntry[1].date).format('YYYY-MM-DD'))) >= 24*60*60*1000 ? ' - Expired' : ''
    return {
      title: `[${+seminarEntry[0] + 1}${expiredStatus}] ${seminarEntry[1].name}`,
      text: moment(seminarEntry[1].date).format('D MMMM YYYY (HH:mm)'),
      menuItems: [
        { type: 'postback', label: "View Detail", data: `!seminar_detail ${seminarEntry[1]._id}` },
        { type: 'postback', label: "Edit", data: `!seminar_edit_template ${seminarEntry[1]._id}` },
        { type: 'postback', label: "Delete", data: `!seminar_delete_confirm ${seminarEntry[1]._id}` }
      ]
    }
  }

  const seminarEntries = _.chain(seminars)
    .sortBy([
      seminar => moment().diff(moment(seminar.date)) > 24*60*60*1000 ? 1 : 0,
      seminar => moment(seminar.date).valueOf()
    ])
    .entries()
    .value()

  if (seminarEntries.length <= 9) {
    return [ seminarEntries.map(seminarEntry => makeSeminarCard(seminarEntry)) ]
  } else {
    const front = [ 
      ..._.chain(seminarEntries)
        .slice(0, 8)
        .map(seminarEntry => makeSeminarCard(seminarEntry))
        .value(),
      makePaginationCard('next', 1)
    ]
    const middle = _.chain(seminarEntries)
      .slice(8, seminarEntries.length - ((seminarEntries.length - 8) % 7))
      .chunk(7)
      .map((chunk, index) => [
        makePaginationCard('previous', index),
        ..._.map(chunk, seminarEntry => makeSeminarCard(seminarEntry)),
        makePaginationCard('next', index + 2)
      ])
      .value()
    const back = [
      makePaginationCard('previous', middle.length),
      ..._.chain(seminarEntries)
        .slice(seminarEntries.length - ((seminarEntries.length - 8) % 7))
        .map(seminarEntry => makeSeminarCard(seminarEntry))
        .value()
    ]
    return [ front, ...middle, back ]
  }
}

async function getViewSeminarMenu(evt, page) {
  const { userId, groupId, type } = evt.source
  const seminars = await db.Event.find(_.assign(
    {
      type: 'seminar',
      envType: type
    },
    ( type === 'user' ? { createdBy: userId } : { groupId } )
  ))
  
  const pages = paginize(seminars)

  page = page || 0
  if (page < 0 || page >= pages.length) return 'Page out of bound!'

  return template.makeCarousel(
    {
      title: 'All Seminars',
      columns: [
        {
          title: "All Seminars", 
          text: seminars.length > 0 ? "Choose an action" : "No seminar yet",
          menuItems: [
            { type: 'postback', label: " ", data: " " },
            { type: 'postback', label: "Add", data: "!seminar_add_template" },
            { type: 'postback', label: "Back to Menu", data: "!woy" }
          ]
        },
        ...pages[page]
      ]
    }
  )
}

async function handler(bot, evt, command, arguments) {

  if (command === '!seminar_view') {
    if (![0, 1].includes(_.size(arguments)))
        return await evt.reply(withFlashes('Arguments must be exactly 0 or 1!'))
    await evt.reply(withFlashes(await getViewSeminarMenu(evt, +(arguments[0] || 0))))
  } else if (command === '!seminar_detail') {
    try {
      if (_.size(arguments) !== 1)
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Seminar not found!'))

      const profile = await bot.getUserProfile(event.createdBy)
      await evt.reply(withFlashes(
        helper.trimAround(`
          [Seminar Detail]
          Name: ${event.name}
          Date: ${moment(event.date).format('D MMMM YYYY (HH:mm)')}
          Created By: ${profile.displayName}
          Created At: ${moment(event.createdAt).format('D MMMM YYYY (HH:mm)')}
        `)
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else if (command === '!seminar_add') {
    try {
      if (_.size(arguments) !== 2)
        return await evt.reply(withFlashes('Arguments must be exactly 2!'))
      if (!moment(arguments[1], 'D-M-YYYY#H:mm', true).isValid()) 
        return await evt.reply(withFlashes('Invalid date!'))

      const { userId, groupId, type } = evt.source
      await db.Event.create(
        {
          name: arguments[0],
          date: moment(arguments[1], 'D-M-YYYY#H:mm').toDate(),
          createdBy: userId,
          groupId: groupId || null,
          envType: type,
          type: 'seminar'
        }
      )
      await evt.reply(withFlashes(
        await getViewSeminarMenu(evt),
        'Seminar created succesfully!'
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!seminar_add_template') {
    await evt.reply(withFlashes(
      `Please copy below input template and replace "seminar name" and "date" as you wish, then Send`,
      `!seminar_add "seminar name" ${moment().format('DD-MM-YYYY#HH:mm')}`
    ))
  


  } else if (command === '!seminar_delete') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Seminar not found!'))

      await event.remove()
      await evt.reply(withFlashes(
        await getViewSeminarMenu(evt),
        'Seminar deleted successfully!'
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!seminar_delete_confirm') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Seminar not found!'))

      await evt.reply(withFlashes(
        template.makeConfirm(
          {
            title: `Delete ${event.name} [${moment().format('D MMMM YYYY (HH:mm)')}] ?`,
            type: 'postback',
            yesText: `!seminar_delete ${event._id}`,
            noText: `!seminar_view`
          }
        )
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else if (command === '!seminar_edit') {
    try {
      if (_.size(arguments) !== 3) 
        return await evt.reply(withFlashes('Arguments must be exactly 3!'))
      if (!moment(arguments[2], 'D-M-YYYY#H:mm', true).isValid()) 
        return await evt.reply(withFlashes('Invalid date!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Seminar not found!'))

      event.name = arguments[1]
      event.date = moment(arguments[2], 'D-M-YYYY#H:mm').toDate()
      await event.save()
      await evt.reply(withFlashes(
        await getViewSeminarMenu(evt),
        `Seminar edited successfully!`
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }
  } else if (command === '!seminar_edit_template') {
    try {
      if (_.size(arguments) !== 1) 
        return await evt.reply(withFlashes('Arguments must be exactly 1!'))
      const event = await db.Event.findById(arguments[0])
      if (!event) 
        return await evt.reply(withFlashes('Seminar not found!'))

      await evt.reply(withFlashes(
        `Please copy below edit template and replace "seminar name" and "date" as you wish, then Send`,
        `!seminar_edit ${event._id} "${event.name}" "${moment(event.date).format('DD-MM-YYYY#HH:mm')}"`
      ))
    } catch (err) {
      await evt.reply(withFlashes('Request failed. Please try again later.'))
    }



  } else {
    await evt.reply(withFlashes())
  }
}

module.exports = handler